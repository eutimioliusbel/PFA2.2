/**
 * useDraftManagement Hook
 * Phase 4: Large File Refactoring
 *
 * Manages draft save, commit, and discard operations
 */

import { useCallback } from 'react';
import type { User, PfaView } from '../types';
import { apiClient, PermissionError } from '../services/apiClient';

interface UseDraftManagementProps {
  currentUser: User | null;
  sessionId: string;
  pendingModifications: Map<string, any>;
  getModificationsArray: () => any[];
  saveDraftMutation: (
    params: { sessionId: string; modifications: any[] },
    options: {
      onSuccess: (response: any) => void;
      onError: (error: unknown) => void;
    }
  ) => void;
  commitChangesMutation: (
    params: { sessionId: string; modifications: any[] },
    options: {
      onSuccess: (response: any) => void;
      onError: (error: unknown) => void;
    }
  ) => void;
  refetchPfaData: () => Promise<any>;
  clearModifications: () => void;
  clearSelection: () => void;
  setDragOverrides: (overrides: any) => void;
  setRemountKey: (fn: (k: number) => number) => void;
  setIsSubmitting: (submitting: boolean) => void;
  setLoadingMessage: (message: string | null) => void;
  setPermissionError: (error: PermissionError | null) => void;
  allPfaRef: React.MutableRefObject<PfaView[]>;
  baselinePfaRef: React.MutableRefObject<PfaView[]>;
}

interface UseDraftManagementReturn {
  handleSaveDraft: () => void;
  handleSubmitChanges: () => void;
  handleDiscardChanges: () => Promise<void>;
}

export function useDraftManagement({
  currentUser,
  sessionId,
  pendingModifications,
  getModificationsArray,
  saveDraftMutation,
  commitChangesMutation,
  refetchPfaData,
  clearModifications,
  clearSelection,
  setDragOverrides,
  setRemountKey,
  setIsSubmitting,
  setLoadingMessage,
  setPermissionError,
  allPfaRef,
  baselinePfaRef,
}: UseDraftManagementProps): UseDraftManagementReturn {
  const cloneAssets = (assets: PfaView[]): PfaView[] =>
    JSON.parse(JSON.stringify(assets));

  const handleSaveDraft = useCallback(() => {
    if (!currentUser?.organizationId || pendingModifications.size === 0) return;

    const modifications = getModificationsArray();
    const startTime = performance.now();

    // OPTIMISTIC UPDATE - Instant UI feedback (within 100ms budget)
    // Clear modifications immediately for perceived performance
    const optimisticModifications = new Map(pendingModifications);
    clearModifications();

    // Show instant success message
    setLoadingMessage('Draft saved');

    // Background API call
    saveDraftMutation(
      {
        sessionId,
        modifications,
      },
      {
        onSuccess: (response) => {
          const elapsed = performance.now() - startTime;
          console.log(`[Performance] Save draft took ${elapsed.toFixed(2)}ms`);

          // Update message with server confirmation
          setLoadingMessage(`Saved ${response.saved} draft changes`);
          setTimeout(() => setLoadingMessage(null), 2000);
        },
        onError: (error) => {
          const elapsed = performance.now() - startTime;
          console.error(`[Performance] Save draft failed after ${elapsed.toFixed(2)}ms`);

          // ROLLBACK on failure - restore pending modifications
          optimisticModifications.forEach((value, key) => {
            pendingModifications.set(key, value);
          });

          if (error instanceof PermissionError) {
            setPermissionError(error);
            setLoadingMessage(null);
          } else {
            const errorMessage =
              error instanceof Error ? error.message : 'Failed to save draft';
            setLoadingMessage(`Error: ${errorMessage} - changes reverted`);
            setTimeout(() => setLoadingMessage(null), 3000);
          }
        },
      }
    );
  }, [
    currentUser,
    sessionId,
    pendingModifications,
    getModificationsArray,
    saveDraftMutation,
    clearModifications,
    setLoadingMessage,
    setPermissionError,
  ]);

  const handleSubmitChanges = useCallback(() => {
    if (!currentUser?.organizationId) return;

    if (
      !window.confirm(
        'Commit all draft changes? This will make them permanent and ready for sync to PEMS.'
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    setLoadingMessage('Committing changes...');

    const modifications = getModificationsArray();

    commitChangesMutation(
      {
        sessionId,
        modifications,
      },
      {
        onSuccess: (response) => {
          setLoadingMessage(`Committed ${response.committed} changes`);
          baselinePfaRef.current = cloneAssets(allPfaRef.current);
          clearModifications();
          setTimeout(() => setLoadingMessage(null), 2000);
          setIsSubmitting(false);
        },
        onError: (error) => {
          if (error instanceof PermissionError) {
            setPermissionError(error);
            setLoadingMessage(null);
          } else {
            const errorMessage =
              error instanceof Error
                ? error.message
                : 'Failed to commit changes';
            setLoadingMessage(`Error: ${errorMessage}`);
            setTimeout(() => setLoadingMessage(null), 3000);
          }
          setIsSubmitting(false);
        },
      }
    );
  }, [
    currentUser,
    sessionId,
    getModificationsArray,
    commitChangesMutation,
    clearModifications,
    setIsSubmitting,
    setLoadingMessage,
    setPermissionError,
    allPfaRef,
    baselinePfaRef,
  ]);

  const handleDiscardChanges = useCallback(async () => {
    if (!currentUser?.organizationId) return;

    if (!window.confirm('Discard all draft changes and revert to synced data?')) {
      return;
    }

    setIsSubmitting(true);
    setLoadingMessage('Discarding drafts...');

    try {
      const response = await apiClient.discardDrafts(currentUser.organizationId, {
        sessionId,
      });

      if (response.success) {
        setLoadingMessage(`Discarded ${response.discarded} draft changes`);
        await refetchPfaData();
        clearModifications();
        clearSelection();
        setDragOverrides(null);
        setRemountKey((k) => k + 1);
        setTimeout(() => setLoadingMessage(null), 2000);
      }
    } catch (error) {
      if (error instanceof PermissionError) {
        setPermissionError(error);
        setLoadingMessage(null);
      } else {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to discard drafts';
        setLoadingMessage(`Error: ${errorMessage}`);
        setTimeout(() => setLoadingMessage(null), 3000);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    currentUser,
    sessionId,
    refetchPfaData,
    clearModifications,
    clearSelection,
    setDragOverrides,
    setRemountKey,
    setIsSubmitting,
    setLoadingMessage,
    setPermissionError,
  ]);

  return {
    handleSaveDraft,
    handleSubmitChanges,
    handleDiscardChanges,
  };
}
