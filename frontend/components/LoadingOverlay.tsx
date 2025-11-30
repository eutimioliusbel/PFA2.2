/**
 * LoadingOverlay Component
 * Phase 6: Large File Refactoring
 *
 * Global loading overlay with animated spinner and message
 */

import React from 'react';
import { Database } from 'lucide-react';

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string | null;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isVisible,
  message,
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center flex-col gap-4 animate-in fade-in duration-300">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Database className="w-6 h-6 text-blue-500 animate-pulse" />
        </div>
      </div>
      <div className="text-white font-bold text-lg tracking-wide">
        {message || "Processing..."}
      </div>
    </div>
  );
};
