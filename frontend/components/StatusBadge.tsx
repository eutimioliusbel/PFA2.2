/**
 * StatusBadge Component
 * Displays color-coded status indicators for users and organizations
 *
 * Color Scheme (WCAG AA compliant):
 * - Green: Active status
 * - Red: Suspended status
 * - Orange: Locked status
 * - Gray: Inactive status
 */

// React 17+ JSX transform doesn't require React import
import { CheckCircle, XCircle, Lock, Pause } from 'lucide-react';

export type StatusType = 'active' | 'suspended' | 'locked' | 'inactive' | 'archived';

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, className = '', size = 'md' }: StatusBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSize = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'active':
        return {
          label: 'Active',
          bgColor: 'bg-green-500/20',
          textColor: 'text-green-400',
          borderColor: 'border-green-500/40',
          icon: <CheckCircle className={iconSize[size]} />,
        };
      case 'suspended':
        return {
          label: 'Suspended',
          bgColor: 'bg-yellow-500/20',
          textColor: 'text-yellow-400',
          borderColor: 'border-yellow-500/40',
          icon: <Pause className={iconSize[size]} />,
        };
      case 'locked':
        return {
          label: 'Locked',
          bgColor: 'bg-red-500/20',
          textColor: 'text-red-400',
          borderColor: 'border-red-500/40',
          icon: <Lock className={iconSize[size]} />,
        };
      case 'archived':
        return {
          label: 'Archived',
          bgColor: 'bg-gray-500/20',
          textColor: 'text-gray-400',
          borderColor: 'border-gray-500/40',
          icon: <XCircle className={iconSize[size]} />,
        };
      case 'inactive':
      default:
        return {
          label: 'Inactive',
          bgColor: 'bg-slate-500/20',
          textColor: 'text-slate-400',
          borderColor: 'border-slate-500/40',
          icon: <XCircle className={iconSize[size]} />,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium
        border ${config.bgColor} ${config.textColor} ${config.borderColor}
        ${sizeClasses[size]} ${className}
      `}
    >
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
}

/**
 * ProviderBadge Component
 * Displays auth provider badge (Local vs. PEMS)
 */
interface ProviderBadgeProps {
  provider: 'local' | 'pems';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ProviderBadge({ provider, className = '', size = 'md' }: ProviderBadgeProps) {
  if (provider === 'local') {
    return null; // Don't show badge for local users
  }

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-2.5 py-1',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded font-semibold
        bg-blue-500/20 text-blue-400 border border-blue-500/40
        ${sizeClasses[size]} ${className}
      `}
    >
      PEMS
    </span>
  );
}
