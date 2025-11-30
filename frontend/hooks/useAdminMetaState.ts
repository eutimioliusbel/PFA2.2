/**
 * useAdminMetaState Hook
 * Phase 6: Large File Refactoring
 *
 * Manages admin and meta data state (users, orgs, apis, system config, export config)
 * Fetches users and organizations from API on mount
 */

import { useState, useEffect } from 'react';
import type { User, Organization, ApiConfig, SystemConfig, DataExchangeConfig, ApiUser, ApiOrganization } from '../types';
import { DEFAULT_EXPORT_CONFIG } from '../constants/defaultConfigs';
import { apiClient } from '../services/apiClient';

/**
 * Maps API user response to UI User type
 */
function mapApiUserToUser(apiUser: ApiUser): User {
  return {
    id: apiUser.id,
    username: apiUser.username,
    role: apiUser.role === 'admin' ? 'admin' : 'user',
    organizationId: apiUser.organizations[0]?.id || '',
    allowedOrganizationIds: apiUser.organizations.map(o => o.id),
    name: apiUser.name || `${apiUser.firstName || ''} ${apiUser.lastName || ''}`.trim() || apiUser.username,
    email: apiUser.email,
    avatarUrl: apiUser.avatarUrl,
  };
}

/**
 * Maps API organization response to UI Organization type
 */
function mapApiOrgToOrg(apiOrg: ApiOrganization): Organization {
  return {
    id: apiOrg.id,
    code: apiOrg.code,
    name: apiOrg.name,
    description: apiOrg.description,
    status: apiOrg.isActive ? 'active' : 'out_of_service',
    logoUrl: apiOrg.logoUrl,
    aiRules: apiOrg.aiRules || [],
    aiConnectionId: apiOrg.aiConnectionId || undefined,
    permissions: {
      viewTimeline: true,
      viewMatrix: true,
      viewGrid: true,
      canExport: true,
    },
    submitMode: apiOrg.submitMode || 'api',
    features: apiOrg.features || { ai: false },
    headerConfig: apiOrg.headerConfig || {
      showLogo: true,
      showId: true,
      showName: true,
      showDescription: true,
    },
  };
}

interface UseAdminMetaStateReturn {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  orgs: Organization[];
  setOrgs: React.Dispatch<React.SetStateAction<Organization[]>>;
  refreshOrgs: () => Promise<void>;
  apis: ApiConfig[];
  setApis: React.Dispatch<React.SetStateAction<ApiConfig[]>>;
  systemConfig: SystemConfig;
  setSystemConfig: React.Dispatch<React.SetStateAction<SystemConfig>>;
  exportConfig: DataExchangeConfig;
  setExportConfig: React.Dispatch<React.SetStateAction<DataExchangeConfig>>;
}

export function useAdminMetaState(): UseAdminMetaStateReturn {
  const [users, setUsers] = useState<User[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [apis, setApis] = useState<ApiConfig[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
    appName: 'PFA Vanguard',
    defaultTheme: 'dark',
    loginLogoUrl: '',
    aiGlobalRules: []
  });
  const [exportConfig, setExportConfig] = useState<DataExchangeConfig>(DEFAULT_EXPORT_CONFIG);

  // Function to refresh organizations from API
  const refreshOrgs = async () => {
    try {
      const orgsResponse = await apiClient.getOrganizations();
      setOrgs(orgsResponse.organizations.map(mapApiOrgToOrg));
    } catch (error) {
      console.error('Failed to refresh organizations:', error);
    }
  };

  // Fetch users and organizations from API on mount
  useEffect(() => {
    const fetchUsersAndOrgs = async () => {
      try {
        const [usersResponse, orgsResponse] = await Promise.all([
          apiClient.getUsers(),
          apiClient.getOrganizations(),
        ]);

        setUsers(usersResponse.users.map(mapApiUserToUser));
        setOrgs(orgsResponse.organizations.map(mapApiOrgToOrg));
      } catch (error) {
        console.error('Failed to fetch users and organizations:', error);
        // Keep empty arrays if fetch fails
      }
    };

    fetchUsersAndOrgs();
  }, []);

  return {
    users,
    setUsers,
    orgs,
    setOrgs,
    refreshOrgs,
    apis,
    setApis,
    systemConfig,
    setSystemConfig,
    exportConfig,
    setExportConfig,
  };
}
