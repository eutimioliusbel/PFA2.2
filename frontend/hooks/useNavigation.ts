/**
 * useNavigation Hook
 * Phase 5: Large File Refactoring
 *
 * Handles organization context switching and navigation
 */

import { useCallback } from 'react';
import type { User, AppMode } from '../types';

interface UseNavigationProps {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setAppMode: (mode: AppMode) => void;
  clearSelection: () => void;
}

interface UseNavigationReturn {
  handleSwitchContext: (orgId: string, mode: AppMode) => void;
  handleNavigateToOrganization: (organizationId: string) => void;
}

export function useNavigation({
  currentUser,
  setCurrentUser,
  setUsers,
  setAppMode,
  clearSelection,
}: UseNavigationProps): UseNavigationReturn {
  const handleSwitchContext = useCallback(
    (orgId: string, mode: AppMode) => {
      if (!currentUser) return;

      // Update the current user state to reflect the new active organization
      const updatedUser = { ...currentUser, organizationId: orgId };
      setCurrentUser(updatedUser);

      // Update the user in the main users list as well
      setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));

      setAppMode(mode);
    },
    [currentUser, setCurrentUser, setUsers, setAppMode]
  );

  const handleNavigateToOrganization = useCallback(
    (organizationId: string) => {
      // Clear selections when switching organizations
      clearSelection();
      // Switch to the organization and navigate to timeline view
      handleSwitchContext(organizationId, 'timeline-lab');
    },
    [clearSelection, handleSwitchContext]
  );

  return {
    handleSwitchContext,
    handleNavigateToOrganization,
  };
}
