// @ts-nocheck - Example file (documentation only)
/**
 * EXAMPLE: How to Use PermissionExplanationTooltip
 *
 * This file demonstrates the proper usage of the PermissionExplanationTooltip
 * component in various scenarios.
 */

import React from 'react';
import { RefreshCw, Trash2, Shield, Users } from 'lucide-react';
import { PermissionExplanationTooltip } from '../PermissionExplanationTooltip';
import { useAuth } from '../../contexts/AuthContext';

// ============================================================================
// Example 1: Sync Button (from ApiConnectivity.tsx)
// ============================================================================

export function SyncButtonExample() {
  const { user, currentOrganizationId } = useAuth();
  const canSync = checkPermission('pems:sync'); // Your permission check function

  return (
    <PermissionExplanationTooltip
      action="pems:sync"
      isDisabled={!canSync}
    >
      <button
        onClick={() => handleSync()}
        disabled={!canSync}
        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
      >
        <RefreshCw className="w-4 h-4" />
        Sync Data
      </button>
    </PermissionExplanationTooltip>
  );
}

// ============================================================================
// Example 2: Delete Button with Request Access Callback
// ============================================================================

export function DeleteButtonExample() {
  const canDelete = checkPermission('users:delete');

  const handleRequestAccess = () => {
    // Open a dialog or navigate to access request page
    console.log('User requested delete permission');
  };

  return (
    <PermissionExplanationTooltip
      action="users:delete"
      isDisabled={!canDelete}
      onRequestAccess={handleRequestAccess}
    >
      <button
        onClick={() => handleDelete()}
        disabled={!canDelete}
        className="p-2 hover:bg-red-500/20 text-red-400 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </PermissionExplanationTooltip>
  );
}

// ============================================================================
// Example 3: Admin Debug Mode (shows full permission chain)
// ============================================================================

export function AdminDebugExample() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canManageSettings = checkPermission('settings:manage');

  return (
    <PermissionExplanationTooltip
      action="settings:manage"
      isDisabled={!canManageSettings}
      debugMode={isAdmin} // Only show debug info for admins
    >
      <button
        onClick={() => handleSettings()}
        disabled={!canManageSettings}
        className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded font-medium transition-colors"
      >
        <Shield className="w-5 h-5" />
        Manage Settings
      </button>
    </PermissionExplanationTooltip>
  );
}

// ============================================================================
// Example 4: Multiple Actions with Different Permissions
// ============================================================================

export function MultipleActionsExample() {
  const canEditUsers = checkPermission('users:edit');
  const canDeleteUsers = checkPermission('users:delete');
  const canViewFinancials = checkPermission('financials:view');

  return (
    <div className="flex gap-2">
      {/* Edit User */}
      <PermissionExplanationTooltip action="users:edit" isDisabled={!canEditUsers}>
        <button
          onClick={() => handleEdit()}
          disabled={!canEditUsers}
          className="p-2 hover:bg-blue-500/20 text-blue-400 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Users className="w-4 h-4" />
        </button>
      </PermissionExplanationTooltip>

      {/* Delete User */}
      <PermissionExplanationTooltip action="users:delete" isDisabled={!canDeleteUsers}>
        <button
          onClick={() => handleDelete()}
          disabled={!canDeleteUsers}
          className="p-2 hover:bg-red-500/20 text-red-400 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </PermissionExplanationTooltip>

      {/* View Financials */}
      <PermissionExplanationTooltip action="financials:view" isDisabled={!canViewFinancials}>
        <button
          onClick={() => handleViewFinancials()}
          disabled={!canViewFinancials}
          className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded font-medium transition-colors"
        >
          View Financials
        </button>
      </PermissionExplanationTooltip>
    </div>
  );
}

// ============================================================================
// Helper Functions (replace with your actual permission check logic)
// ============================================================================

function checkPermission(action: string): boolean {
  // This should be replaced with your actual permission checking logic
  // Example:
  // const { user, currentOrganizationId } = useAuth();
  // const org = user?.organizations.find(o => o.id === currentOrganizationId);
  // return org?.permissions?.['perm_Sync'] === true;

  return false; // Default to false for demo purposes
}

function handleSync() {
  console.log('Sync triggered');
}

function handleDelete() {
  console.log('Delete triggered');
}

function handleEdit() {
  console.log('Edit triggered');
}

function handleSettings() {
  console.log('Settings triggered');
}

function handleViewFinancials() {
  console.log('View financials triggered');
}

// ============================================================================
// ACTUAL IMPLEMENTATION EXAMPLE (for ApiConnectivity.tsx)
// ============================================================================

/**
 * How to integrate into ApiConnectivity.tsx (line 1070-1088):
 *
 * Before:
 * ```tsx
 * {selectedConfig.feeds && (
 *   <button
 *     onClick={() => handleSyncData(selectedConfig)}
 *     disabled={isSyncing}
 *     className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
 *   >
 *     {isSyncing ? (
 *       <>
 *         <Loader2 className="w-4 h-4 animate-spin" />
 *         Syncing...
 *       </>
 *     ) : (
 *       <>
 *         <RefreshCw className="w-4 h-4" />
 *         Sync Data
 *       </>
 *     )}
 *   </button>
 * )}
 * ```
 *
 * After:
 * ```tsx
 * import { PermissionExplanationTooltip } from '../PermissionExplanationTooltip';
 *
 * // In component:
 * const { user } = useAuth();
 * const canSync = user?.organizations.find(o => o.id === currentOrganizationId)?.permissions?.perm_Sync === true;
 *
 * {selectedConfig.feeds && (
 *   <PermissionExplanationTooltip
 *     action="pems:sync"
 *     isDisabled={!canSync}
 *     debugMode={user?.role === 'admin'}
 *   >
 *     <button
 *       onClick={() => handleSyncData(selectedConfig)}
 *       disabled={isSyncing || !canSync}
 *       className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
 *     >
 *       {isSyncing ? (
 *         <>
 *           <Loader2 className="w-4 h-4 animate-spin" />
 *           Syncing...
 *         </>
 *       ) : (
 *         <>
 *           <RefreshCw className="w-4 h-4" />
 *           Sync Data
 *         </>
 *       )}
 *     </button>
 *   </PermissionExplanationTooltip>
 * )}
 * ```
 */
