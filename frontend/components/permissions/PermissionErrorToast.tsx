/**
 * PermissionErrorToast Component
 * Phase 4, Task 4.1 - Frontend Permission Integration
 *
 * Toast notification shown when user attempts an action they don't have permission for.
 * Shows 403 errors from backend with clear messaging about required permission.
 *
 * Usage:
 *   {permissionError && (
 *     <PermissionErrorToast
 *       error={permissionError}
 *       onClose={() => setPermissionError(null)}
 *     />
 *   )}
 */

import { useEffect } from 'react';
import { X, ShieldAlert } from 'lucide-react';
import { PermissionError } from '../../services/apiClient';

interface PermissionErrorToastProps {
  /** Permission error from API */
  error: PermissionError;
  /** Close handler */
  onClose: () => void;
  /** Auto-dismiss duration in ms (default: 8000) */
  autoDismiss?: number;
}

/**
 * Toast notification for permission errors
 *
 * @param error - PermissionError instance from API
 * @param onClose - Callback when toast is dismissed
 * @param autoDismiss - Auto-dismiss after this many milliseconds
 */
export function PermissionErrorToast({
  error,
  onClose,
  autoDismiss = 8000,
}: PermissionErrorToastProps) {
  // Auto-dismiss after timeout
  useEffect(() => {
    if (autoDismiss > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, autoDismiss);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [autoDismiss, onClose]);

  // Format permission name for display
  const formatPermission = (perm: string) => {
    return perm
      .replace('perm_', '')
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .trim();
  };

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md animate-slide-in-from-right">
      <div className="bg-red-500 text-white rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-red-600">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <h3 className="font-semibold text-lg">Permission Denied</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
            aria-label="Close notification"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* Error message */}
          <p className="text-white/90">{error.message}</p>

          {/* Required permission */}
          <div className="bg-red-600/30 rounded-md p-3 border border-red-400/20">
            <p className="text-sm font-medium text-white/80">Required permission:</p>
            <p className="text-white font-mono text-sm mt-1">
              {formatPermission(error.permission)}
            </p>
          </div>

          {/* Error code (if available) */}
          {error.errorCode && (
            <p className="text-xs text-white/60 font-mono">
              Error: {error.errorCode}
            </p>
          )}

          {/* Help text */}
          <p className="text-sm text-white/70 border-t border-red-400/20 pt-3">
            Contact your administrator to request this permission.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Generic error toast for non-permission errors
 */
export function ErrorToast({
  message,
  onClose,
  autoDismiss = 5000,
}: {
  message: string;
  onClose: () => void;
  autoDismiss?: number;
}) {
  // Auto-dismiss after timeout
  useEffect(() => {
    if (autoDismiss > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, autoDismiss);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [autoDismiss, onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md animate-slide-in-from-right">
      <div className="bg-yellow-500 text-yellow-900 rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <p className="font-medium pr-4">{message}</p>
          <button
            onClick={onClose}
            className="text-yellow-900/60 hover:text-yellow-900 transition-colors flex-shrink-0"
            aria-label="Close notification"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
