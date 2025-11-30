/**
 * useAuthActions Hook
 * Phase 6: Large File Refactoring
 *
 * Auth-related actions (logout handler)
 */

import { useCallback } from 'react';

interface UseAuthActionsProps {
  authLogout: () => void;
  setShowProfile: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setAiMode: (mode: 'hidden' | 'panel' | 'voice') => void;
}

interface UseAuthActionsReturn {
  handleLogout: () => void;
}

export function useAuthActions({
  authLogout,
  setShowProfile,
  setShowSettings,
  setAiMode,
}: UseAuthActionsProps): UseAuthActionsReturn {
  const handleLogout = useCallback(() => {
    authLogout();
    setShowProfile(false);
    setShowSettings(false);
    setAiMode('hidden');
  }, [authLogout, setShowProfile, setShowSettings, setAiMode]);

  return {
    handleLogout,
  };
}
