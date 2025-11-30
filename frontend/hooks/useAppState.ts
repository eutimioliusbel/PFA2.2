/**
 * useAppState Hook
 * Consolidates app-level Zustand subscriptions
 * Phase 1B: Large File Refactoring
 *
 * Combines subscriptions from:
 * - appStore: UI state, navigation, modals, selection
 * - draftStore: Pending modifications tracking
 * - historyStore: Undo/redo functionality
 */

import { useAppStore } from '../stores/appStore';
import { useDraftStore } from '../stores/draftStore';
import { useHistoryStore } from '../stores/historyStore';

export function useAppState() {
  // App Store - UI State
  const appMode = useAppStore((state) => state.appMode);
  const setAppMode = useAppStore((state) => state.setAppMode);
  const isNavOpen = useAppStore((state) => state.isNavOpen);
  const toggleNavigation = useAppStore((state) => state.toggleNavigation);
  const isFilterOpen = useAppStore((state) => state.isFilterOpen);
  const toggleFilter = useAppStore((state) => state.toggleFilter);
  const showSettings = useAppStore((state) => state.showSettings);
  const setShowSettings = useAppStore((state) => state.setShowSettings);
  const showProfile = useAppStore((state) => state.showProfile);
  const setShowProfile = useAppStore((state) => state.setShowProfile);
  const aiMode = useAppStore((state) => state.aiMode);
  const setAiMode = useAppStore((state) => state.setAiMode);
  const showNewForecastModal = useAppStore((state) => state.showNewForecastModal);
  const setShowNewForecastModal = useAppStore(
    (state) => state.setShowNewForecastModal
  );

  // App Store - Selection State
  const selectedIds = useAppStore((state) => state.selectedIds);
  const toggleSelection = useAppStore((state) => state.toggleSelection);
  const selectMultiple = useAppStore((state) => state.selectMultiple);
  const clearSelection = useAppStore((state) => state.clearSelection);
  const selectAll = useAppStore((state) => state.selectAll);
  const focusMode = useAppStore((state) => state.focusMode);
  const setFocusMode = useAppStore((state) => state.setFocusMode);

  // Draft Store - Modification Tracking
  const pendingModifications = useDraftStore((state) => state.pendingModifications);
  const sessionId = useDraftStore((state) => state.sessionId);
  const hasUnsavedChanges = useDraftStore((state) => state.hasUnsavedChanges);
  const addModification = useDraftStore((state) => state.addModification);
  const addMultipleModifications = useDraftStore(
    (state) => state.addMultipleModifications
  );
  const clearModifications = useDraftStore((state) => state.clearModifications);
  const getModificationsArray = useDraftStore(
    (state) => state.getModificationsArray
  );
  const resetDraftSession = useDraftStore((state) => state.resetSession);

  // History Store - Undo/Redo
  const canUndo = useHistoryStore((state) => state.canUndo);
  const canRedo = useHistoryStore((state) => state.canRedo);
  const commitHistory = useHistoryStore((state) => state.commit);
  const undoHistory = useHistoryStore((state) => state.undo);
  const redoHistory = useHistoryStore((state) => state.redo);
  const resetHistory = useHistoryStore((state) => state.reset);
  const clearHistory = useHistoryStore((state) => state.clearHistory);

  return {
    // UI State
    appMode,
    setAppMode,
    isNavOpen,
    toggleNavigation,
    isFilterOpen,
    toggleFilter,
    showSettings,
    setShowSettings,
    showProfile,
    setShowProfile,
    aiMode,
    setAiMode,
    showNewForecastModal,
    setShowNewForecastModal,

    // Selection State
    selectedIds,
    toggleSelection,
    selectMultiple,
    clearSelection,
    selectAll,
    focusMode,
    setFocusMode,

    // Draft State
    pendingModifications,
    sessionId,
    hasUnsavedChanges,
    addModification,
    addMultipleModifications,
    clearModifications,
    getModificationsArray,
    resetDraftSession,

    // History State
    canUndo,
    canRedo,
    commitHistory,
    undoHistory,
    redoHistory,
    resetHistory,
    clearHistory,
  };
}
