
import React from 'react';
import { Settings, User as UserIcon, Building2 } from 'lucide-react';
import { User, Organization } from '../types';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenProfile?: () => void;
  onAdminClick?: () => void;
  appLogoUrl?: string; // System Config Logo
  appName: string;
  org?: Organization; // Current Organization
  user?: User;
  showBranding?: boolean; // Toggle App Logo/Name
  showUserProfile?: boolean; // Toggle User Avatar section
  hideSettings?: boolean; // Hide settings button for read-only views
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings, onOpenProfile, onAdminClick: _onAdminClick,
  appLogoUrl, appName, org, user,
  showBranding = true,
  showUserProfile = true,
  hideSettings = false
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 transition-all duration-300 ease-in-out shadow-sm z-40 relative h-16 flex-none">
      <div className="px-4 h-full flex items-center justify-between bg-white dark:bg-slate-900 z-10 relative transition-colors duration-300">
        
        {/* LEFT: App Identity (Optional) */}
        <div className="flex items-center gap-3 w-1/3">
          {showBranding && (
            <>
              <div className="w-10 h-10 flex items-center justify-center overflow-hidden flex-none">
                {appLogoUrl ? (
                    <img src={appLogoUrl} alt="App Logo" className="w-full h-full object-contain" />
                ) : (
                    <div className="w-full h-full bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-orange-500"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"/><path d="M14 2v6h6"/><path d="M4 15v7"/><path d="M4 12v3"/><path d="M4 9v3"/><path d="M4 6v3"/></svg>
                    </div>
                )}
              </div>
              <div className="hidden md:block">
                  <h1 className="text-lg font-black text-slate-900 dark:text-slate-100 leading-none tracking-wide">{appName}</h1>
              </div>
            </>
          )}
        </div>
        
        {/* CENTER: Organization Identity (Dynamic Config) */}
        <div className="flex-1 flex justify-center w-1/3 h-full py-1">
            {org ? (
                (() => {
                    const config = org.headerConfig || { showLogo: true, showId: true, showName: false, showDescription: false };
                    const textElementCount = [config.showName, config.showId, config.showDescription].filter(Boolean).length;
                    const hasLogo = config.showLogo;
                    const isOnlyElement = textElementCount === 1 && !hasLogo;
                    const isTwoElements = textElementCount === 2 && !hasLogo;

                    // Dynamic sizes based on element count
                    const nameSize = isOnlyElement ? 'text-base' : isTwoElements ? 'text-sm' : 'text-[11px]';
                    const idSize = isOnlyElement ? 'text-sm' : isTwoElements ? 'text-xs' : 'text-[9px]';
                    const descSize = isOnlyElement ? 'text-xs' : 'text-[9px]';
                    const logoSize = textElementCount === 0 ? 'h-12' : 'h-10';
                    const logoIconSize = textElementCount === 0 ? 'w-10 h-10' : 'w-8 h-8';

                    return (
                        <div className="flex flex-col items-center justify-center leading-tight">
                            {/* Logo */}
                            {config.showLogo && (
                                <div className={`mb-0.5 ${logoSize} flex items-center justify-center transition-all`}>
                                    {org.logoUrl ? (
                                        <img src={org.logoUrl} alt="Org Logo" className="h-full w-auto max-w-[180px] object-contain" />
                                    ) : (
                                        <Building2 className={`${logoIconSize} text-slate-400`} />
                                    )}
                                </div>
                            )}

                            {/* Info Stack */}
                            <div className="flex flex-col items-center">
                                {config.showName && (
                                    <span className={`${nameSize} font-bold text-slate-900 dark:text-white truncate max-w-[250px]`}>{org.name}</span>
                                )}
                                {config.showId && (
                                    <span className={`${idSize} font-mono text-slate-500 dark:text-slate-400 max-w-[200px] truncate ${config.showName ? '' : 'font-semibold'}`}>{org.code || org.id}</span>
                                )}
                                {config.showDescription && (
                                    <span className={`${descSize} text-slate-500 dark:text-slate-400 max-w-[300px] truncate hidden md:block ${config.showName || config.showId ? '-mt-0.5' : ''}`}>{org.description}</span>
                                )}
                                {/* Fallback if nothing enabled */}
                                {!config.showName && !config.showId && !config.showDescription && !config.showLogo && (
                                    <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[250px]">{org.name}</span>
                                )}
                            </div>
                        </div>
                    );
                })()
            ) : (
                <span className="text-xs text-slate-400 italic self-center">No Organization Selected</span>
            )}
        </div>
        
        {/* RIGHT: User Controls */}
        <div className="flex items-center justify-end gap-2 w-1/3">

          {!hideSettings && (
            <button
              onClick={onOpenSettings}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="View Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {showUserProfile && (
            <>
              <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1"></div>
              
              {/* User Avatar */}
              {user && (
                 <button 
                    onClick={onOpenProfile}
                    className="ml-2 w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all shadow-sm"
                    title="My Profile"
                 >
                    {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="User" className="w-full h-full object-cover" />
                    ) : (
                        <UserIcon className="w-4 h-4 text-slate-500" />
                    )}
                 </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
