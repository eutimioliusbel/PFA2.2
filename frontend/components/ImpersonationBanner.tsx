/**
 * Impersonation Banner Component
 * ADR-005 Implementation: View As Visual Indicator
 *
 * Displays an orange banner when admin is viewing as another user.
 * Shows countdown timer and allows exiting impersonation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Eye, X, Clock, AlertTriangle } from 'lucide-react';
import { apiClient } from '../services/apiClient';

interface ImpersonationBannerProps {
  onEndImpersonation: () => Promise<void>;
}

interface ImpersonationStatus {
  isImpersonating: boolean;
  impersonatedBy?: {
    userId: string;
    username: string;
    name: string;
  };
  expiresAt?: string;
  remainingMinutes?: number;
  currentUser?: {
    userId: string;
    username: string;
  };
}

export const ImpersonationBanner: React.FC<ImpersonationBannerProps> = ({
  onEndImpersonation,
}) => {
  const [status, setStatus] = useState<ImpersonationStatus | null>(null);
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [isEnding, setIsEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check impersonation status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const result = await apiClient.getImpersonationStatus();
        setStatus(result);
        if (result.remainingMinutes) {
          setRemainingTime(result.remainingMinutes * 60); // Convert to seconds
        }
      } catch (err) {
        console.error('Failed to check impersonation status:', err);
      }
    };

    checkStatus();
    // Poll every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!status?.isImpersonating || remainingTime <= 0) return;

    const timer = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          // Session expired, trigger end impersonation
          handleEndImpersonation();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status?.isImpersonating, remainingTime]);

  const handleEndImpersonation = useCallback(async () => {
    if (isEnding) return;

    setIsEnding(true);
    setError(null);

    try {
      await onEndImpersonation();
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end impersonation');
    } finally {
      setIsEnding(false);
    }
  }, [isEnding, onEndImpersonation]);

  // Don't render if not impersonating
  if (!status?.isImpersonating) {
    return null;
  }

  // Format remaining time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isExpiringSoon = remainingTime > 0 && remainingTime <= 120; // Last 2 minutes

  return (
    <div
      className={`
        fixed top-0 left-0 right-0 z-[100] px-4 py-2
        ${isExpiringSoon ? 'bg-red-600' : 'bg-orange-500'}
        text-white shadow-lg transition-colors duration-300
      `}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Status Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
            <Eye className="w-4 h-4" />
            <span className="text-sm font-semibold">View As Mode</span>
          </div>

          <span className="text-sm">
            You are viewing as{' '}
            <strong className="font-bold">
              {status.currentUser?.username || 'another user'}
            </strong>
          </span>

          {status.impersonatedBy && (
            <span className="text-xs opacity-75">
              (Admin: {status.impersonatedBy.name || status.impersonatedBy.username})
            </span>
          )}
        </div>

        {/* Center: Timer */}
        <div className="flex items-center gap-2">
          {remainingTime > 0 && (
            <div className={`
              flex items-center gap-1.5 px-3 py-1 rounded-full
              ${isExpiringSoon ? 'bg-white/30 animate-pulse' : 'bg-white/20'}
            `}>
              <Clock className="w-3.5 h-3.5" />
              <span className="text-sm font-mono font-bold">
                {formatTime(remainingTime)}
              </span>
            </div>
          )}

          {isExpiringSoon && (
            <div className="flex items-center gap-1 text-xs">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Session expiring soon!</span>
            </div>
          )}
        </div>

        {/* Right: Exit Button */}
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-xs text-red-200">{error}</span>
          )}

          <button
            onClick={handleEndImpersonation}
            disabled={isEnding}
            className={`
              flex items-center gap-2 px-4 py-1.5 rounded-lg
              bg-white/20 hover:bg-white/30
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors text-sm font-medium
            `}
          >
            {isEnding ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Exiting...</span>
              </>
            ) : (
              <>
                <X className="w-4 h-4" />
                <span>Exit Impersonation</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImpersonationBanner;
