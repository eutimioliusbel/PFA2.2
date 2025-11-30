/**
 * useAppUIState Hook
 * Phase 6: Large File Refactoring
 *
 * Manages UI-specific state (loading, errors, drag overrides, modals)
 */

import { useState } from 'react';
import type { PermissionError } from '../services/apiClient';

interface UseAppUIStateReturn {
  dragOverrides: Map<string, { start: Date; end: Date; layer: 'forecast' | 'actual' }> | null;
  setDragOverrides: React.Dispatch<React.SetStateAction<Map<string, { start: Date; end: Date; layer: 'forecast' | 'actual' }> | null>>;
  newForecastInitialValues: any;
  setNewForecastInitialValues: React.Dispatch<React.SetStateAction<any>>;
  permissionError: PermissionError | null;
  setPermissionError: React.Dispatch<React.SetStateAction<PermissionError | null>>;
  isSubmitting: boolean;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  loadingMessage: string | null;
  setLoadingMessage: React.Dispatch<React.SetStateAction<string | null>>;
  remountKey: number;
  setRemountKey: React.Dispatch<React.SetStateAction<number>>;
}

export function useAppUIState(): UseAppUIStateReturn {
  const [dragOverrides, setDragOverrides] = useState<Map<string, { start: Date; end: Date; layer: 'forecast' | 'actual' }> | null>(null);
  const [newForecastInitialValues, setNewForecastInitialValues] = useState<any>(undefined);
  const [permissionError, setPermissionError] = useState<PermissionError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [remountKey, setRemountKey] = useState(0);

  return {
    dragOverrides,
    setDragOverrides,
    newForecastInitialValues,
    setNewForecastInitialValues,
    permissionError,
    setPermissionError,
    isSubmitting,
    setIsSubmitting,
    loadingMessage,
    setLoadingMessage,
    remountKey,
    setRemountKey,
  };
}
