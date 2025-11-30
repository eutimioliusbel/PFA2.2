/**
 * PermissionGuard Component
 * Phase 2B, Task 2B.1 - Permission-Aware UI Components
 *
 * Conditionally renders children based on user permissions.
 * Shows helpful messages when permissions are missing.
 *
 * Usage:
 *   <PermissionGuard permission="perm_EditForecast" showReason>
 *     <EditButton />
 *   </PermissionGuard>
 */

import { ReactNode } from 'react';
import { usePermissions, PermissionSet } from '../hooks/usePermissions';
import { Info } from 'lucide-react';

interface PermissionGuardProps {
  /** Permission required to show children */
  permission: keyof PermissionSet;
  /** Content to render when user has permission */
  children: ReactNode;
  /** Content to render when permission is missing (optional) */
  fallback?: ReactNode;
  /** Show reason why content is hidden (optional, default: false) */
  showReason?: boolean;
  /** Custom reason message (optional) */
  reasonMessage?: string;
}

/**
 * Guard component that shows/hides content based on permissions
 *
 * @param permission - Required permission name
 * @param children - Content to show if permission granted
 * @param fallback - Content to show if permission denied
 * @param showReason - Show explanation message when denied
 * @param reasonMessage - Custom message for denial
 */
export function PermissionGuard({
  permission,
  children,
  fallback,
  showReason = false,
  reasonMessage,
}: PermissionGuardProps) {
  const { hasPermission } = usePermissions();

  // Check if user has the required permission
  if (!hasPermission(permission)) {
    // Show reason for denial
    if (showReason) {
      const defaultMessage = `Missing permission: ${permission.replace('perm_', '')}`;
      const message = reasonMessage || defaultMessage;

      return (
        <div className="opacity-50 cursor-not-allowed">
          <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <Info className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            <span className="text-sm text-yellow-800">{message}</span>
          </div>
          {fallback && <div className="mt-2">{fallback}</div>}
        </div>
      );
    }

    // Just show fallback or nothing
    return <>{fallback || null}</>;
  }

  // Permission granted - render children
  return <>{children}</>;
}
