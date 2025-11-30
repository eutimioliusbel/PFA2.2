/**
 * MenuItem Component
 * Phase 2: Large File Refactoring
 *
 * Reusable menu item for navigation sidebar
 */

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MenuItemProps {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
  isNavOpen?: boolean;
}

export const MenuItem: React.FC<MenuItemProps> = ({
  label,
  icon: Icon,
  active,
  onClick,
  isNavOpen = true,
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group whitespace-nowrap
            ${
              active
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
            }
        `}
    title={!isNavOpen ? label : ''}
  >
    <Icon
      className={`w-4 h-4 flex-none ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}
    />
    <span
      className={`transition-opacity duration-200 ${isNavOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}
    >
      {label}
    </span>
  </button>
);

interface MenuHeaderProps {
  label: string;
  isNavOpen?: boolean;
  logoUrl?: string;
  code?: string;
}

// Simple divider component for menu sections
export const Divider: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`my-2 border-t border-slate-700/50 ${className}`} />
);

export const MenuHeader: React.FC<MenuHeaderProps> = ({
  label,
  isNavOpen = true,
  logoUrl,
  code,
}) => {
  const [imgError, setImgError] = React.useState(false);

  // Reset error when logoUrl changes
  React.useEffect(() => {
    setImgError(false);
  }, [logoUrl]);

  const showLogo = logoUrl || code;
  const initial = code ? code.charAt(0).toUpperCase() : label.charAt(0).toUpperCase();

  return (
    <div
      className={`px-3 mt-4 mb-2 flex items-center gap-2 transition-all duration-300`}
    >
      {showLogo && (
        <div className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
          {logoUrl && !imgError ? (
            <img
              src={logoUrl}
              alt={label}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="text-[9px] font-bold text-slate-400">{initial}</span>
          )}
        </div>
      )}
      <span
        className={`text-[10px] font-bold text-slate-500 uppercase tracking-wider transition-opacity duration-300 ${isNavOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}
      >
        {label}
      </span>
    </div>
  );
};
