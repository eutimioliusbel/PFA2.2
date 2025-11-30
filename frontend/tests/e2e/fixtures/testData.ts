/**
 * Test Data Fixtures
 *
 * Static test data for E2E tests
 * WARNING: Do not use production user credentials
 */

export interface TestUser {
  id: string;
  username: string;
  password: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user' | 'viewer';
  serviceStatus: 'active' | 'suspended' | 'locked';
}

export interface TestOrganization {
  id: string;
  code: string;
  name: string;
  description: string;
}

/**
 * Test Admin User
 * Has full access to all features
 */
export const TEST_ADMIN: TestUser = {
  id: 'test-admin-001',
  username: 'test-admin',
  password: 'Test@Admin123!',
  email: 'test-admin@example.com',
  firstName: 'Test',
  lastName: 'Admin',
  role: 'admin',
  serviceStatus: 'active',
};

/**
 * Test Regular User
 * Has limited permissions, used for permission testing
 */
export const TEST_USER: TestUser = {
  id: 'test-user-001',
  username: 'test-user',
  password: 'Test@User123!',
  email: 'test-user@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'user',
  serviceStatus: 'active',
};

/**
 * Test User for Suspension Testing
 * Will be suspended during tests
 */
export const TEST_USER_SUSPEND: TestUser = {
  id: 'test-user-suspend-001',
  username: 'test-user-suspend',
  password: 'Test@UserSuspend123!',
  email: 'test-user-suspend@example.com',
  firstName: 'Test',
  lastName: 'UserSuspend',
  role: 'user',
  serviceStatus: 'active',
};

/**
 * Test Viewer User
 * Has read-only permissions
 */
export const TEST_VIEWER: TestUser = {
  id: 'test-viewer-001',
  username: 'test-viewer',
  password: 'Test@Viewer123!',
  email: 'test-viewer@example.com',
  firstName: 'Test',
  lastName: 'Viewer',
  role: 'viewer',
  serviceStatus: 'active',
};

/**
 * Test Organizations
 */
export const TEST_ORG_PRIMARY: TestOrganization = {
  id: 'test-org-primary-001',
  code: 'TEST-ORG-1',
  name: 'Test Organization Primary',
  description: 'Primary test organization for E2E tests',
};

export const TEST_ORG_SECONDARY: TestOrganization = {
  id: 'test-org-secondary-001',
  code: 'TEST-ORG-2',
  name: 'Test Organization Secondary',
  description: 'Secondary test organization for multi-org tests',
};

/**
 * Test Permission Sets
 */
export const PERMISSION_SETS = {
  ADMIN: {
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
  EDITOR: {
    perm_Read: true,
    perm_EditForecast: true,
    perm_EditActuals: false,
    perm_Delete: false,
    perm_Import: false,
    perm_RefreshData: true,
    perm_Export: true,
    perm_ViewFinancials: true,
    perm_SaveDraft: true,
    perm_Sync: false,
    perm_ManageUsers: false,
    perm_ManageSettings: false,
    perm_ConfigureAlerts: false,
    perm_Impersonate: false,
  },
  VIEWER: {
    perm_Read: true,
    perm_EditForecast: false,
    perm_EditActuals: false,
    perm_Delete: false,
    perm_Import: false,
    perm_RefreshData: false,
    perm_Export: true,
    perm_ViewFinancials: false,
    perm_SaveDraft: false,
    perm_Sync: false,
    perm_ManageUsers: false,
    perm_ManageSettings: false,
    perm_ConfigureAlerts: false,
    perm_Impersonate: false,
  },
};

/**
 * Test API Endpoints
 */
export const API_ENDPOINTS = {
  LOGIN: '/api/auth/login',
  VERIFY: '/api/auth/verify',
  USERS: '/api/users',
  USER_BY_ID: (id: string) => `/api/users/${id}`,
  USER_SUSPEND: (id: string) => `/api/users/${id}/suspend`,
  USER_ACTIVATE: (id: string) => `/api/users/${id}/activate`,
  USER_ORGS: (userId: string) => `/api/users/${userId}/organizations`,
  USER_ORG_CAPABILITIES: (userOrgId: string) => `/api/user-organizations/${userOrgId}/capabilities`,
  USER_ORG_ROLE: (userOrgId: string) => `/api/user-organizations/${userOrgId}/role`,
  USER_ORG_REVOKE: (userOrgId: string) => `/api/user-organizations/${userOrgId}`,
  ORGANIZATIONS: '/api/organizations',
  ORG_BY_ID: (id: string) => `/api/organizations/${id}`,
};

/**
 * Test Selectors (CSS/XPath selectors for UI elements)
 */
export const SELECTORS = {
  // Login Screen
  LOGIN_USERNAME: 'input[name="username"]',
  LOGIN_PASSWORD: 'input[name="password"]',
  LOGIN_SUBMIT: 'button[type="submit"]',

  // User Management
  USER_MANAGEMENT_TAB: 'text=User Management',
  USER_TABLE: 'table',
  USER_ROW: (username: string) => `tr:has-text("${username}")`,
  USER_SUSPEND_BTN: 'button[title="Suspend User"]',
  USER_ACTIVATE_BTN: 'button[title="Activate User"]',
  USER_EDIT_BTN: 'button[title="Edit User"]',
  USER_DELETE_BTN: 'button[title="Delete User"]',
  USER_PERMISSIONS_BTN: 'button[title="Manage Organization Permissions"]',

  // Suspend Dialog
  SUSPEND_DIALOG: '.fixed.inset-0',
  SUSPEND_REASON_INPUT: 'textarea',
  SUSPEND_CONFIRM_BTN: 'button:has-text("Suspend User")',
  SUSPEND_CANCEL_BTN: 'button:has-text("Cancel")',

  // User Org Permissions Modal
  USER_ORG_MODAL: 'text=User Organization Permissions',
  USER_ORG_TABLE: 'table',
  USER_ORG_ROW: (orgCode: string) => `tr:has-text("${orgCode}")`,
  USER_ORG_CAPABILITY_BTN: 'button[title*="Configure Capabilities"]',
  USER_ORG_REVOKE_BTN: 'button[title*="Revoke Access"]',

  // Capability Editor Modal
  CAPABILITY_MODAL: 'text=Configure Capabilities',
  CAPABILITY_CHECKBOX: (permission: string) => `input[type="checkbox"][name="${permission}"]`,
  CAPABILITY_SAVE_BTN: 'button:has-text("Save Changes")',
  CAPABILITY_CANCEL_BTN: 'button:has-text("Cancel")',

  // Status Badges
  STATUS_BADGE: (status: string) => `.status-badge:has-text("${status}")`,
  PROVIDER_BADGE: (provider: string) => `.provider-badge:has-text("${provider}")`,

  // Refresh Button
  REFRESH_BTN: 'button:has-text("Refresh")',

  // Error Messages
  ERROR_BANNER: '.bg-red-500',
  SUCCESS_BANNER: '.bg-green-500',
};

/**
 * Test Timeouts (in milliseconds)
 */
export const TIMEOUTS = {
  SHORT: 1000, // 1 second
  MEDIUM: 3000, // 3 seconds
  LONG: 5000, // 5 seconds
  API_REQUEST: 2000, // 2 seconds (for API calls)
  PAGE_LOAD: 10000, // 10 seconds
};

/**
 * Test Messages
 */
export const MESSAGES = {
  SUSPEND_SUCCESS: 'User suspended successfully',
  ACTIVATE_SUCCESS: 'User activated successfully',
  PERMISSION_GRANT_SUCCESS: 'Permissions updated successfully',
  PERMISSION_REVOKE_SUCCESS: 'Access revoked successfully',
  DELETE_SUCCESS: 'User deleted successfully',
  ACCOUNT_SUSPENDED: 'Account suspended',
  PERMISSION_DENIED: 'Permission denied',
  INVALID_CREDENTIALS: 'Invalid credentials',
};
