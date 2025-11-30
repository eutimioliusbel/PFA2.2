/**
 * useUserOrganizations Hook
 * Phase 6: Large File Refactoring
 *
 * Computes user-allowed organizations and active organization.
 * Organizations are fetched from the database via API, not mock data.
 */

import { useMemo } from 'react';
import type { User, Organization } from '../types';

interface UseUserOrganizationsProps {
  currentUser: User | null;
  orgs: Organization[];
}

interface UseUserOrganizationsReturn {
  userAllowedOrgs: Organization[];
  activeOrg: Organization;
}

/**
 * Default organization used when no orgs are available (loading state).
 * This should never be used in production since orgs are fetched from the database.
 */
const DEFAULT_ORG: Organization = {
  id: 'default',
  code: 'LOADING',
  name: 'Loading...',
  status: 'active',
  aiRules: [],
  permissions: {
    viewTimeline: true,
    viewMatrix: true,
    viewGrid: true,
    canExport: true,
  },
  submitMode: 'download',
  features: { ai: false },
  headerConfig: {
    showLogo: false,
    showId: true,
    showName: true,
    showDescription: false,
  },
};

export function useUserOrganizations({
  currentUser,
  orgs,
}: UseUserOrganizationsProps): UseUserOrganizationsReturn {
  // Determine which organizations the user can access
  const userAllowedOrgs = useMemo(() => {
    if (!currentUser) return [];
    return orgs.filter(o => currentUser.allowedOrganizationIds.includes(o.id));
  }, [currentUser, orgs]);

  // Get the active organization - fallback to first allowed org, then first org, then default
  const activeOrg = useMemo(() => {
    const matchedOrg = orgs.find(o => o.id === currentUser?.organizationId);
    if (matchedOrg) return matchedOrg;
    if (userAllowedOrgs.length > 0) return userAllowedOrgs[0];
    if (orgs.length > 0) return orgs[0];
    return DEFAULT_ORG;
  }, [currentUser, orgs, userAllowedOrgs]);

  return {
    userAllowedOrgs,
    activeOrg,
  };
}
