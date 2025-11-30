/**
 * usePermissions Hook
 * Phase 2B, Task 2B.1 - Permission-Aware UI Components
 *
 * Provides permission checking functionality for the current user and organization.
 * Works with mock data for development (backend integration in Phase 4).
 *
 * Usage:
 *   const { permissions, hasPermission, isReadOnly, role } = usePermissions();
 *
 *   if (hasPermission('perm_EditForecast')) {
 *     // User can edit forecast data
 *   }
 */

import { useAuth } from '../contexts/AuthContext';

export interface PermissionSet {
  perm_Read: boolean;
  perm_EditForecast: boolean;
  perm_EditActuals: boolean;
  perm_Delete: boolean;
  perm_Import: boolean;
  perm_RefreshData: boolean;
  perm_Export: boolean;
  perm_ViewFinancials: boolean;
  perm_SaveDraft: boolean;
  perm_Sync: boolean;
  perm_ManageUsers: boolean;
  perm_ManageSettings: boolean;
  perm_ConfigureAlerts: boolean;
  perm_Impersonate: boolean;
}

export interface UsePermissionsResult {
  permissions: PermissionSet | undefined;
  hasPermission: (permission: keyof PermissionSet, orgId?: string) => boolean;
  isReadOnly: boolean;
  role: string | undefined;
}

/**
 * Hook to check user permissions for the current organization
 *
 * @returns {UsePermissionsResult} Permission checking utilities
 */
export function usePermissions(): UsePermissionsResult {
  const { user, currentOrganizationId } = useAuth();

  // Find current organization's permissions
  const currentOrgPermission = user?.organizations.find(
    o => o.id === currentOrganizationId
  );

  /**
   * Check if user has a specific permission
   *
   * @param permission - Permission name (e.g., 'perm_EditForecast')
   * @param orgId - Optional organization ID (defaults to current org)
   * @returns {boolean} True if user has the permission
   */
  const hasPermission = (permission: keyof PermissionSet, orgId?: string): boolean => {
    if (!user) return false;

    const targetOrgId = orgId || currentOrganizationId;
    const org = user.organizations.find(o => o.id === targetOrgId);

    return org?.permissions?.[permission] || false;
  };

  /**
   * Check if user is in read-only mode (no write permissions)
   */
  const isReadOnly = !(
    hasPermission('perm_EditForecast') ||
    hasPermission('perm_EditActuals') ||
    hasPermission('perm_SaveDraft') ||
    hasPermission('perm_Sync')
  );

  return {
    permissions: currentOrgPermission?.permissions,
    hasPermission,
    isReadOnly,
    role: currentOrgPermission?.role,
  };
}
