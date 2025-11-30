/**
 * PermissionButton Component
 * Phase 2B, Task 2B.1 - Permission-Aware UI Components
 *
 * Button that automatically disables based on user permissions.
 * Shows lock icon and tooltip when permission is missing.
 *
 * Usage:
 *   <PermissionButton
 *     permission="perm_EditForecast"
 *     onClick={handleEdit}
 *     className="btn-primary"
 *   >
 *     Edit Forecast
 *   </PermissionButton>
 */

import { ReactNode, ButtonHTMLAttributes } from 'react';
import { usePermissions, PermissionSet } from '../hooks/usePermissions';
import { Lock } from 'lucide-react';

interface PermissionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  /** Permission required to enable button */
  permission: keyof PermissionSet;
  /** Click handler (only called if permission granted) */
  onClick: () => void;
  /** Button content */
  children: ReactNode;
  /** Custom tooltip message (optional) */
  tooltipMessage?: string;
  /** Show lock icon when disabled (default: true) */
  showLockIcon?: boolean;
}

/**
 * Permission-aware button component
 *
 * @param permission - Required permission name
 * @param onClick - Click handler
 * @param children - Button content
 * @param tooltipMessage - Custom tooltip for disabled state
 * @param showLockIcon - Show lock icon when disabled
 * @param className - Additional CSS classes
 */
export function PermissionButton({
  permission,
  onClick,
  children,
  tooltipMessage,
  showLockIcon = true,
  className = '',
  disabled = false,
  ...rest
}: PermissionButtonProps) {
  const { hasPermission } = usePermissions();

  // Check if user has the required permission
  const allowed = hasPermission(permission);
  const isDisabled = disabled || !allowed;

  // Generate tooltip message
  const defaultTooltip = `Requires ${permission.replace('perm_', '')} permission`;
  const tooltip = !allowed ? (tooltipMessage || defaultTooltip) : undefined;

  // Generate button classes
  const buttonClasses = `
    ${className}
    ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    inline-flex items-center justify-center gap-2
    transition-all duration-150
  `.trim();

  return (
    <button
      onClick={allowed && !disabled ? onClick : undefined}
      disabled={isDisabled}
      className={buttonClasses}
      title={tooltip}
      {...rest}
    >
      {!allowed && showLockIcon && <Lock className="w-4 h-4" aria-hidden="true" />}
      {children}
    </button>
  );
}
