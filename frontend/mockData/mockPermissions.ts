/**
 * Mock Permission Data
 * Phase 2B, Task 2B.1 - Permission-Aware UI Components
 *
 * Provides sample user data with different permission levels for development.
 * Use this data to test permission-aware components without backend integration.
 *
 * User Profiles:
 * - Admin: All 14 permissions
 * - Manager: Most permissions except admin/impersonate
 * - Editor: Can edit and draft, but cannot sync or delete
 * - Viewer: Read-only access
 */

import { ApiUser } from '../services/apiClient';

/**
 * Mock Admin User - Full Permissions
 */
export const MOCK_ADMIN_USER: ApiUser = {
  id: 'mock-admin-001',
  username: 'admin_user',
  email: 'admin@pfa-vanguard.com',
  firstName: 'Admin',
  lastName: 'User',
  role: 'admin',
  organizations: [
    {
      id: 'org-holng-001',
      code: 'HOLNG',
      name: 'Holland LNG Terminal',
      role: 'admin',
      permissions: {
        perm_Read: true,
        perm_EditForecast: true,
        perm_EditActuals: true,
        perm_Delete: true,
        perm_Import: true,
        perm_RefreshData: true,
        perm_Export: true,
        perm_ViewFinancials: true,
        perm_SaveDraft: true,
        perm_Sync: true,
        perm_ManageUsers: true,
        perm_ManageSettings: true,
        perm_ConfigureAlerts: true,
        perm_Impersonate: true,
      },
    },
    {
      id: 'org-rio-001',
      code: 'RIO',
      name: 'Rio Tinto Mine Expansion',
      role: 'admin',
      permissions: {
        perm_Read: true,
        perm_EditForecast: true,
        perm_EditActuals: true,
        perm_Delete: true,
        perm_Import: true,
        perm_RefreshData: true,
        perm_Export: true,
        perm_ViewFinancials: true,
        perm_SaveDraft: true,
        perm_Sync: true,
        perm_ManageUsers: true,
        perm_ManageSettings: true,
        perm_ConfigureAlerts: true,
        perm_Impersonate: true,
      },
    },
  ],
};

/**
 * Mock Manager User - Most Permissions (no admin/impersonate)
 */
export const MOCK_MANAGER_USER: ApiUser = {
  id: 'mock-manager-001',
  username: 'manager_user',
  email: 'manager@pfa-vanguard.com',
  firstName: 'Project',
  lastName: 'Manager',
  role: 'user',
  organizations: [
    {
      id: 'org-holng-001',
      code: 'HOLNG',
      name: 'Holland LNG Terminal',
      role: 'manager',
      permissions: {
        perm_Read: true,
        perm_EditForecast: true,
        perm_EditActuals: true,
        perm_Delete: true,
        perm_Import: true,
        perm_RefreshData: true,
        perm_Export: true,
        perm_ViewFinancials: true,
        perm_SaveDraft: true,
        perm_Sync: true,
        perm_ManageUsers: false, // Cannot manage users
        perm_ManageSettings: false, // Cannot manage settings
        perm_ConfigureAlerts: true,
        perm_Impersonate: false, // Cannot impersonate
      },
    },
  ],
};

/**
 * Mock Editor User - Can Edit and Draft (no sync or delete)
 */
export const MOCK_EDITOR_USER: ApiUser = {
  id: 'mock-editor-001',
  username: 'editor_user',
  email: 'editor@pfa-vanguard.com',
  firstName: 'Equipment',
  lastName: 'Planner',
  role: 'user',
  organizations: [
    {
      id: 'org-holng-001',
      code: 'HOLNG',
      name: 'Holland LNG Terminal',
      role: 'editor',
      permissions: {
        perm_Read: true,
        perm_EditForecast: true,
        perm_EditActuals: false, // Cannot edit actuals
        perm_Delete: false, // Cannot delete
        perm_Import: false, // Cannot import
        perm_RefreshData: false, // Cannot refresh
        perm_Export: true,
        perm_ViewFinancials: true,
        perm_SaveDraft: true,
        perm_Sync: false, // Cannot sync to PEMS
        perm_ManageUsers: false,
        perm_ManageSettings: false,
        perm_ConfigureAlerts: false,
        perm_Impersonate: false,
      },
    },
  ],
};

/**
 * Mock Viewer User - Read-Only Access
 */
export const MOCK_VIEWER_USER: ApiUser = {
  id: 'mock-viewer-001',
  username: 'viewer_user',
  email: 'viewer@pfa-vanguard.com',
  firstName: 'Financial',
  lastName: 'Analyst',
  role: 'viewer',
  organizations: [
    {
      id: 'org-holng-001',
      code: 'HOLNG',
      name: 'Holland LNG Terminal',
      role: 'viewer',
      permissions: {
        perm_Read: true,
        perm_EditForecast: false,
        perm_EditActuals: false,
        perm_Delete: false,
        perm_Import: false,
        perm_RefreshData: false,
        perm_Export: true, // Can export for analysis
        perm_ViewFinancials: true, // Can view costs
        perm_SaveDraft: false,
        perm_Sync: false,
        perm_ManageUsers: false,
        perm_ManageSettings: false,
        perm_ConfigureAlerts: false,
        perm_Impersonate: false,
      },
    },
  ],
};

/**
 * Mock Multi-Org User - Different Permissions Per Organization
 */
export const MOCK_MULTI_ORG_USER: ApiUser = {
  id: 'mock-multi-001',
  username: 'multi_org_user',
  email: 'multi@pfa-vanguard.com',
  firstName: 'Multi',
  lastName: 'Org User',
  role: 'user',
  organizations: [
    {
      id: 'org-holng-001',
      code: 'HOLNG',
      name: 'Holland LNG Terminal',
      role: 'admin',
      permissions: {
        perm_Read: true,
        perm_EditForecast: true,
        perm_EditActuals: true,
        perm_Delete: true,
        perm_Import: true,
        perm_RefreshData: true,
        perm_Export: true,
        perm_ViewFinancials: true,
        perm_SaveDraft: true,
        perm_Sync: true,
        perm_ManageUsers: true,
        perm_ManageSettings: true,
        perm_ConfigureAlerts: true,
        perm_Impersonate: false,
      },
    },
    {
      id: 'org-rio-001',
      code: 'RIO',
      name: 'Rio Tinto Mine Expansion',
      role: 'viewer',
      permissions: {
        perm_Read: true,
        perm_EditForecast: false,
        perm_EditActuals: false,
        perm_Delete: false,
        perm_Import: false,
        perm_RefreshData: false,
        perm_Export: true,
        perm_ViewFinancials: true,
        perm_SaveDraft: false,
        perm_Sync: false,
        perm_ManageUsers: false,
        perm_ManageSettings: false,
        perm_ConfigureAlerts: false,
        perm_Impersonate: false,
      },
    },
  ],
};

/**
 * Helper function to get mock user by role
 */
export function getMockUserByRole(role: 'admin' | 'manager' | 'editor' | 'viewer'): ApiUser {
  switch (role) {
    case 'admin':
      return MOCK_ADMIN_USER;
    case 'manager':
      return MOCK_MANAGER_USER;
    case 'editor':
      return MOCK_EDITOR_USER;
    case 'viewer':
      return MOCK_VIEWER_USER;
    default:
      return MOCK_VIEWER_USER;
  }
}

/**
 * Helper function to simulate API login with mock data
 */
export function mockLogin(role: 'admin' | 'manager' | 'editor' | 'viewer'): { token: string; user: ApiUser } {
  return {
    token: `mock-jwt-token-${role}-${Date.now()}`,
    user: getMockUserByRole(role),
  };
}
