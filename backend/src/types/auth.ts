/**
 * Authentication Type Definitions
 * Phase 2, Task 2.1 - Enhanced JWT Payload with Granular Permissions
 */

import { Request } from 'express';

/**
 * Granular permission flags (16 permissions across 6 categories)
 * Maps directly to UserOrganization table columns
 */
export interface Permissions {
  // 1. Data Scope (The "What") - 4 permissions
  perm_Read: boolean;
  perm_EditForecast: boolean;
  perm_EditActuals: boolean;
  perm_Delete: boolean;

  // 2. Data Operations (The "How") - 3 permissions
  perm_Import: boolean;
  perm_RefreshData: boolean;
  perm_Export: boolean;

  // 3. Financials (The "Mask") - 1 permission
  perm_ViewFinancials: boolean;

  // 4. Process (The "Workflow") - 2 permissions
  perm_SaveDraft: boolean;
  perm_Sync: boolean;

  // 5. Admin (The "Control") - 4 permissions
  perm_ManageUsers: boolean;
  perm_ManageSettings: boolean;
  perm_ConfigureAlerts: boolean;
  perm_Impersonate: boolean;

  // 6. BEO Intelligence (Cross-Org) - 2 permissions
  perm_ViewAllOrgs: boolean;      // CVE-2024-BEO-001 fix: Access BEO cross-org analytics
  perm_UseAiFeatures: boolean;    // Access AI-powered features
}

/**
 * Organization context with permissions
 */
export interface OrganizationContext {
  organizationId: string;
  organizationCode: string;
  role: string; // Legacy role field (kept for backward compatibility)
  permissions: Permissions;
}

/**
 * Enhanced JWT Payload with embedded permissions
 * Includes all user organizations and their permissions
 */
export interface JWTPayload {
  userId: string;
  username: string;
  email: string | null;
  authProvider: 'local' | 'pems';
  serviceStatus: 'active' | 'suspended' | 'locked';
  organizations: OrganizationContext[];
  iat: number;
  exp: number;
}

/**
 * Extended Express Request with authenticated user
 */
export interface AuthRequest extends Request {
  user?: JWTPayload;
  organizationId?: string; // Attached by requirePermission/requireOrgAccess middleware
}

/**
 * Permission denial audit log entry
 */
export interface PermissionDenialLog {
  userId: string;
  username: string;
  organizationId: string;
  permission: keyof Permissions;
  endpoint: string;
  method: string;
  timestamp: Date;
}

/**
 * Organization validation result
 */
export interface OrganizationValidationResult {
  id: string;
  code: string;
  serviceStatus: string;
  isActive: boolean;
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  granted: boolean;
  reason?: string;
  organizationContext?: OrganizationContext;
}

/**
 * Type guard to check if a key is a valid permission
 */
export function isPermissionKey(key: string): key is keyof Permissions {
  const permissionKeys: (keyof Permissions)[] = [
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
    'perm_ViewAllOrgs',
    'perm_UseAiFeatures',
  ];
  return permissionKeys.includes(key as keyof Permissions);
}

/**
 * Helper to extract permissions from UserOrganization record
 */
export function extractPermissions(userOrg: any): Permissions {
  return {
    perm_Read: userOrg.perm_Read,
    perm_EditForecast: userOrg.perm_EditForecast,
    perm_EditActuals: userOrg.perm_EditActuals,
    perm_Delete: userOrg.perm_Delete,
    perm_Import: userOrg.perm_Import,
    perm_RefreshData: userOrg.perm_RefreshData,
    perm_Export: userOrg.perm_Export,
    perm_ViewFinancials: userOrg.perm_ViewFinancials,
    perm_SaveDraft: userOrg.perm_SaveDraft,
    perm_Sync: userOrg.perm_Sync,
    perm_ManageUsers: userOrg.perm_ManageUsers,
    perm_ManageSettings: userOrg.perm_ManageSettings,
    perm_ConfigureAlerts: userOrg.perm_ConfigureAlerts,
    perm_Impersonate: userOrg.perm_Impersonate,
    perm_ViewAllOrgs: userOrg.perm_ViewAllOrgs ?? false,
    perm_UseAiFeatures: userOrg.perm_UseAiFeatures ?? false,
  };
}
