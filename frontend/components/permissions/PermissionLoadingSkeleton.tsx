/**
 * PermissionLoadingSkeleton Component
 * Phase 4, Task 4.1 - Frontend Permission Integration
 *
 * Loading skeleton shown while permissions are being loaded from JWT.
 * Prevents UI flicker by showing placeholder content.
 *
 * Usage:
 *   {isLoading && <PermissionLoadingSkeleton />}
 */

// React 17+ JSX transform doesn't require React import

interface PermissionLoadingSkeletonProps {
  /** Optional custom message */
  message?: string;
}

/**
 * Skeleton loader for permission checks
 */
export function PermissionLoadingSkeleton({ message }: PermissionLoadingSkeletonProps = {}) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900">
      <div className="w-full max-w-2xl p-8 space-y-6">
        {/* Header skeleton */}
        <div className="animate-pulse">
          <div className="h-12 bg-slate-700 rounded-lg mb-6"></div>

          {/* Content blocks */}
          <div className="space-y-4">
            <div className="h-32 bg-slate-700 rounded-lg"></div>
            <div className="h-48 bg-slate-700 rounded-lg"></div>
            <div className="h-24 bg-slate-700 rounded-lg"></div>
          </div>

          {/* Loading message */}
          {message && (
            <div className="mt-8 text-center">
              <p className="text-slate-400 text-sm">{message}</p>
            </div>
          )}

          {/* Default loading message */}
          {!message && (
            <div className="mt-8 text-center">
              <div className="inline-flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 text-sm">Loading permissions...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact skeleton for inline loading states
 */
export function PermissionLoadingSkeletonInline() {
  return (
    <div className="animate-pulse">
      <div className="h-10 bg-slate-700 rounded mb-4"></div>
      <div className="h-64 bg-slate-700 rounded"></div>
    </div>
  );
}
