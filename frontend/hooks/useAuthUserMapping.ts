/**
 * useAuthUserMapping Hook
 * Phase 6: Large File Refactoring
 *
 * Maps backend auth user to app user format (temporary bridge until full migration)
 * Handles permission flattening from organization-level permissions to user-level array.
 */

import { useState, useEffect } from 'react';
import type { User } from '../types';
import type { ApiUser, Permissions } from '../services/apiClient';

// All available permissions (ADR-005 compliant)
const ALL_PERMISSIONS = [
  'perm_Read',
  'perm_EditForecast',
  'perm_EditActuals',
  'perm_Delete',
  'perm_Import',
  'perm_RefreshData',
  'perm_Export',
  'perm_ViewFinancials',
  'perm_SaveDraft',
  'perm_Sync',
  'perm_ManageUsers',
  'perm_ManageSettings',
  'perm_ConfigureAlerts',
  'perm_Impersonate',
  'perm_UseAiFeatures',
] as const;

type AuthUser = ApiUser;

interface UseAuthUserMappingProps {
  authUser: AuthUser | null;
}

interface UseAuthUserMappingReturn {
  currentUser: User | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
}

/**
 * Extracts a flattened array of permission strings from user's organizations.
 * For admin users, returns all permissions.
 * For other users, returns union of all permissions they have in any organization.
 */
function extractPermissions(authUser: AuthUser): string[] {
  // Admin role gets all permissions
  if (authUser.role === 'admin') {
    return [...ALL_PERMISSIONS];
  }

  // Check if any org has admin role
  const hasAdminInOrg = authUser.organizations.some((org) => org.role === 'admin');
  if (hasAdminInOrg) {
    return [...ALL_PERMISSIONS];
  }

  // For non-admin users, flatten all permissions from all organizations
  const permissionSet = new Set<string>();

  for (const org of authUser.organizations) {
    if (org.permissions) {
      // Iterate over all known permissions and check if they're true
      for (const permKey of ALL_PERMISSIONS) {
        if (org.permissions[permKey as keyof Permissions] === true) {
          permissionSet.add(permKey);
        }
      }
    }
  }

  return Array.from(permissionSet);
}

/**
 * Determines if user is a BEO (Business Enterprise Overhead) user.
 * BEO users have access to cross-organization portfolio features.
 */
function isBeoUser(authUser: AuthUser): boolean {
  // Admin users are automatically BEO users
  if (authUser.role === 'admin') {
    return true;
  }

  // Check if any org has admin role
  const hasAdminInOrg = authUser.organizations.some((org) => org.role === 'admin');
  if (hasAdminInOrg) {
    return true;
  }

  // Users with perm_ManageSettings in any org are BEO users
  for (const org of authUser.organizations) {
    if (org.permissions?.perm_ManageSettings === true) {
      return true;
    }
  }

  // Users with access to multiple organizations are BEO users
  if (authUser.organizations.length > 1) {
    return true;
  }

  return false;
}

export function useAuthUserMapping({
  authUser,
}: UseAuthUserMappingProps): UseAuthUserMappingReturn {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Sync currentUser with authUser
  useEffect(() => {
    if (authUser) {
      const permissions = extractPermissions(authUser);
      const beoStatus = isBeoUser(authUser);

      setCurrentUser({
        id: authUser.id,
        username: authUser.username,
        name:
          `${authUser.firstName || ''} ${authUser.lastName || ''}`.trim() || authUser.username,
        email: authUser.email,
        role: authUser.role === 'admin' ? 'admin' : 'user',
        organizationId: authUser.organizations[0]?.id || authUser.organizations[0]?.code || '',
        allowedOrganizationIds: authUser.organizations.map((o) => o.code || o.id),
        themePreference: 'system',
        permissions,
        isBeoUser: beoStatus,
      });
    } else {
      setCurrentUser(null);
    }
  }, [authUser]);

  return { currentUser, setCurrentUser };
}
