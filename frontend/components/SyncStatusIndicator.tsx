/**
 * SyncStatusIndicator - Display sync status for PFA modifications
 * ADR-008 Phase 2 Track B - Task 2B.1
 *
 * Shows visual indicator of sync state with tooltip details.
 * Accessibility: Keyboard navigable, ARIA labels, screen reader support.
 */

import { type PfaModification } from '../types';

interface SyncStatusIndicatorProps {
  modification: PfaModification;
  onClick?: () => void;
  compact?: boolean;
}

interface StatusConfig {
  icon: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

const STATUS_CONFIGS: Record<
  PfaModification['syncState'],
  StatusConfig
> = {
  draft: {
    icon: '✎',
    label: 'Draft',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    description: 'Unsaved local changes',
  },
  committed: {
    icon: '⏳',
    label: 'Queued',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
    description: 'Committed and queued for sync',
  },
  syncing: {
    icon: '↻',
    label: 'Syncing',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
    description: 'Currently syncing to PEMS',
  },
  sync_error: {
    icon: '✗',
    label: 'Failed',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
    description: 'Sync failed - click for details',
  },
};

function formatTimestamp(date?: Date): string {
  if (!date) return 'Never';

  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function getTooltipContent(modification: PfaModification): string {
  const config = STATUS_CONFIGS[modification.syncState];
  const lines = [
    `Status: ${config.label}`,
    config.description,
    '',
    `Modified: ${formatTimestamp(modification.updatedAt)}`,
  ];

  if (modification.committedAt) {
    lines.push(`Committed: ${formatTimestamp(modification.committedAt)}`);
  }

  if (modification.modifiedFields.length > 0) {
    lines.push('', 'Changed fields:');
    modification.modifiedFields.forEach(field => {
      lines.push(`  • ${field}`);
    });
  }

  if (modification.changeReason) {
    lines.push('', `Reason: ${modification.changeReason}`);
  }

  return lines.join('\n');
}

export function SyncStatusIndicator({
  modification,
  onClick,
  compact = false,
}: SyncStatusIndicatorProps) {
  const config = STATUS_CONFIGS[modification.syncState];
  const isClickable = Boolean(onClick);
  const isAnimated = modification.syncState === 'syncing';

  const tooltipContent = getTooltipContent(modification);

  return (
    <div className="relative group inline-block">
      <button
        type="button"
        onClick={onClick}
        disabled={!isClickable}
        aria-label={`Sync status: ${config.label}. ${
          isClickable ? 'Click for details.' : ''
        }`}
        aria-live="polite"
        role="status"
        title={tooltipContent}
        className={`
          inline-flex items-center gap-1.5 px-2 py-1 rounded-md border
          ${config.color} ${config.bgColor} ${config.borderColor}
          ${isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
          ${isAnimated ? 'animate-pulse' : ''}
          transition-opacity duration-150
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
        `}
      >
        <span
          className={`text-sm font-medium ${
            isAnimated ? 'inline-block animate-spin' : ''
          }`}
          aria-hidden="true"
        >
          {config.icon}
        </span>
        {!compact && (
          <span className="text-xs font-medium">{config.label}</span>
        )}
        {!compact && modification.modifiedFields.length > 0 && (
          <span className="text-xs opacity-70">
            ({modification.modifiedFields.length})
          </span>
        )}
      </button>

      {/* Enhanced tooltip on hover */}
      <div
        className="absolute z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100
                   transition-opacity duration-200 pointer-events-none
                   bottom-full left-1/2 -translate-x-1/2 mb-2"
        role="tooltip"
      >
        <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-pre-line max-w-xs shadow-lg">
          {tooltipContent}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
            <div className="border-8 border-transparent border-t-gray-900" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact variant for grid view
 */
export function CompactSyncStatusIndicator(
  props: Omit<SyncStatusIndicatorProps, 'compact'>
) {
  return <SyncStatusIndicator {...props} compact />;
}
