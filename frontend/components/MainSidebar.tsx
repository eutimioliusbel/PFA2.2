/**
 * MainSidebar Component
 * Phase 2: Large File Refactoring
 *
 * Main navigation sidebar with organization-aware menu items
 */

import React from 'react';
import {
  PanelLeftOpen,
  PanelLeftClose,
  Activity,
  Table,
  LayoutGrid,
  Blocks,
  FileDown,
  Plug,
  Server,
  Database,
  Building2,
  Settings,
  Bell,
  BellRing,
  Users,
  Monitor,
  Tag,
  Layers,
  Factory,
  Truck,
  Box,
  Search,
  TrendingUp,
  Brain,
  HeartPulse,
  BookOpen,
  TrendingDown,
  DollarSign,
  Zap,
  LogOut,
  Shield,
  ClipboardCheck,
  GitMerge,
  MapPin,
} from 'lucide-react';
import { MenuItem, MenuHeader } from './ui/MenuItem';
import type { User, Organization, AppMode, ScreenKey, ScreenPermissions } from '../types';

interface MainSidebarProps {
  isNavOpen: boolean;
  toggleNavigation: () => void;
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  currentUser: User;
  userAllowedOrgs: Organization[];
  handleSwitchContext: (orgId: string, mode: AppMode) => void;
  setShowProfile: (show: boolean) => void;
  handleLogout: () => void;
  screenAccess?: ScreenPermissions;
}

export const MainSidebar: React.FC<MainSidebarProps> = ({
  isNavOpen,
  toggleNavigation,
  appMode,
  setAppMode,
  currentUser,
  userAllowedOrgs,
  handleSwitchContext,
  setShowProfile,
  handleLogout,
  screenAccess,
}) => {
  /**
   * Check if user can access a specific screen.
   * Falls back to admin role check for backwards compatibility.
   */
  const canAccessScreen = (screen: ScreenKey): boolean => {
    // Admin always has full access (backwards compatibility)
    if (currentUser.role === 'admin') return true;
    // If screenAccess is defined, check it
    if (screenAccess) {
      return !!screenAccess[screen];
    }
    // If no screenAccess defined, non-admins cannot see admin screens
    return false;
  };

  // Check if user can see any screen in a category
  const canAccessAnyScreen = (screens: ScreenKey[]): boolean => {
    return screens.some(canAccessScreen);
  };

  return (
    <aside
      className={`${isNavOpen ? 'w-64' : 'w-16'} flex-none bg-slate-900 text-white flex flex-col border-r border-slate-800 transition-all duration-300 ease-in-out overflow-hidden relative z-50 shadow-xl`}
    >
      <div className="flex flex-col h-full">
        {/* Brand */}
        <div
          className={`h-16 flex items-center ${isNavOpen ? 'px-6 justify-between' : 'justify-center'} border-b border-slate-800 flex-none transition-all`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-none shadow-lg shadow-blue-600/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div
              className={`min-w-0 transition-opacity duration-300 ${isNavOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}
            >
              <div className="font-black text-sm tracking-tight leading-none">
                PFA
              </div>
              <div className="font-bold text-sm tracking-tight text-slate-400 leading-none">
                Vanguard
              </div>
            </div>
          </div>
          {isNavOpen && (
            <button
              onClick={toggleNavigation}
              className="text-slate-500 hover:text-white transition-colors"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {!isNavOpen && (
          <div className="flex justify-center py-4 border-b border-slate-800">
            <button
              onClick={toggleNavigation}
              className="p-3 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-500 transition-colors"
              title="Expand Navigation"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
          {/* Per Organization Grouping */}
          {userAllowedOrgs.map((org) => (
            <React.Fragment key={org.id}>
              <MenuHeader label={org.name} isNavOpen={isNavOpen} logoUrl={org.logoUrl} code={org.code} />
              <MenuItem
                label="Timeline Lab"
                icon={Activity}
                active={
                  appMode === 'timeline-lab' &&
                  currentUser.organizationId === org.id
                }
                onClick={() => handleSwitchContext(org.id, 'timeline-lab')}
                isNavOpen={isNavOpen}
              />
              <MenuItem
                label="Matrix Lab"
                icon={Table}
                active={
                  appMode === 'matrix-lab' &&
                  currentUser.organizationId === org.id
                }
                onClick={() => handleSwitchContext(org.id, 'matrix-lab')}
                isNavOpen={isNavOpen}
              />
              <MenuItem
                label="Grid Lab"
                icon={LayoutGrid}
                active={
                  appMode === 'grid-lab' &&
                  currentUser.organizationId === org.id
                }
                onClick={() => handleSwitchContext(org.id, 'grid-lab')}
                isNavOpen={isNavOpen}
              />
              <MenuItem
                label="PFA 1.0 Lab"
                icon={Blocks}
                active={
                  appMode === 'pfa-1.0-lab' &&
                  currentUser.organizationId === org.id
                }
                onClick={() => handleSwitchContext(org.id, 'pfa-1.0-lab')}
                isNavOpen={isNavOpen}
              />
            </React.Fragment>
          ))}

          {/* General Tools Section */}
          <MenuHeader label="Tools" isNavOpen={isNavOpen} />
          <MenuItem
            label="Export Data"
            icon={FileDown}
            active={appMode === 'export'}
            onClick={() => setAppMode('export')}
            isNavOpen={isNavOpen}
          />

          {/* Administration Section - Permission-gated */}
          {canAccessAnyScreen([
            'screen_ApiConnectivity', 'screen_ApiServers', 'screen_DataImport',
            'screen_MappingStudio', 'screen_FieldConfig', 'screen_BeoGlass',
            'screen_Organizations', 'screen_SystemSettings', 'screen_Notifications',
            'screen_UserManagement', 'screen_RoleTemplates',
          ]) && (
            <>
              <MenuHeader label="Administration" isNavOpen={isNavOpen} />
              {canAccessScreen('screen_ApiConnectivity') && (
                <MenuItem
                  label="API Connectivity"
                  icon={Plug}
                  active={appMode === 'api-connectivity'}
                  onClick={() => setAppMode('api-connectivity')}
                  isNavOpen={isNavOpen}
                />
              )}
              {canAccessScreen('screen_ApiServers') && (
                <MenuItem
                  label="API Servers"
                  icon={Server}
                  active={appMode === 'api-servers'}
                  onClick={() => setAppMode('api-servers')}
                  isNavOpen={isNavOpen}
                />
              )}
              {canAccessScreen('screen_DataImport') && (
                <MenuItem
                  label="Data Import"
                  icon={Database}
                  active={appMode === 'data-import'}
                  onClick={() => setAppMode('data-import')}
                  isNavOpen={isNavOpen}
                />
              )}
              {canAccessScreen('screen_MappingStudio') && (
                <MenuItem
                  label="Mapping Studio"
                  icon={GitMerge}
                  active={appMode === 'mapping-studio'}
                  onClick={() => setAppMode('mapping-studio')}
                  isNavOpen={isNavOpen}
                />
              )}
              {canAccessScreen('screen_FieldConfig') && (
                <MenuItem
                  label="Field Configuration"
                  icon={FileDown}
                  active={appMode === 'field-config'}
                  onClick={() => setAppMode('field-config')}
                  isNavOpen={isNavOpen}
                />
              )}
              {canAccessScreen('screen_BeoGlass') && (
                <MenuItem
                  label="BEO Glass Mode"
                  icon={LayoutGrid}
                  active={appMode === 'beo-glass'}
                  onClick={() => setAppMode('beo-glass')}
                  isNavOpen={isNavOpen}
                />
              )}
              {canAccessScreen('screen_Organizations') && (
                <MenuItem
                  label="Organizations"
                  icon={Building2}
                  active={appMode === 'organization'}
                  onClick={() => setAppMode('organization')}
                  isNavOpen={isNavOpen}
                />
              )}
              {canAccessScreen('screen_SystemSettings') && (
                <MenuItem
                  label="System Settings"
                  icon={Settings}
                  active={appMode === 'system-settings'}
                  onClick={() => setAppMode('system-settings')}
                  isNavOpen={isNavOpen}
                />
              )}
              {canAccessScreen('screen_Notifications') && (
                <MenuItem
                  label="Notifications"
                  icon={Bell}
                  active={appMode === 'notification-settings'}
                  onClick={() => setAppMode('notification-settings')}
                  isNavOpen={isNavOpen}
                />
              )}
              {canAccessScreen('screen_SystemSettings') && (
                <MenuItem
                  label="Event Triggers"
                  icon={BellRing}
                  active={appMode === 'notification-events'}
                  onClick={() => setAppMode('notification-events')}
                  isNavOpen={isNavOpen}
                />
              )}
              {canAccessScreen('screen_UserManagement') && (
                <MenuItem
                  label="Users"
                  icon={Users}
                  active={appMode === 'user-management'}
                  onClick={() => setAppMode('user-management')}
                  isNavOpen={isNavOpen}
                />
              )}
              {canAccessScreen('screen_RoleTemplates') && (
                <MenuItem
                  label="Roles"
                  icon={Shield}
                  active={appMode === 'role-templates'}
                  onClick={() => setAppMode('role-templates')}
                  isNavOpen={isNavOpen}
                />
              )}
              {canAccessScreen('screen_UserManagement') && (
                <MenuItem
                  label="Approval Queue"
                  icon={ClipboardCheck}
                  active={appMode === 'approval-queue'}
                  onClick={() => setAppMode('approval-queue')}
                  isNavOpen={isNavOpen}
                />
              )}

              {/* Master Data Section - Permission-gated */}
              {canAccessScreen('screen_MasterData') && (
                <>
                  <MenuHeader label="Master Data" isNavOpen={isNavOpen} />
                  <MenuItem
                    label="Asset"
                    icon={Monitor}
                    active={appMode === 'asset-master'}
                    onClick={() => setAppMode('asset-master')}
                    isNavOpen={isNavOpen}
                  />
                  <MenuItem
                    label="Class & Category"
                    icon={Tag}
                    active={appMode === 'class-master'}
                    onClick={() => setAppMode('class-master')}
                    isNavOpen={isNavOpen}
                  />
                  <MenuItem
                    label="DOR"
                    icon={Layers}
                    active={appMode === 'dor-master'}
                    onClick={() => setAppMode('dor-master')}
                    isNavOpen={isNavOpen}
                  />
                  <MenuItem
                    label="Manufacturers"
                    icon={Factory}
                    active={appMode === 'manufacturer-master'}
                    onClick={() => setAppMode('manufacturer-master')}
                    isNavOpen={isNavOpen}
                  />
                  <MenuItem
                    label="Models"
                    icon={Truck}
                    active={appMode === 'model-master'}
                    onClick={() => setAppMode('model-master')}
                    isNavOpen={isNavOpen}
                  />
                  <MenuItem
                    label="Area / Silo"
                    icon={MapPin}
                    active={appMode === 'area-silo-master'}
                    onClick={() => setAppMode('area-silo-master')}
                    isNavOpen={isNavOpen}
                  />
                  <MenuItem
                    label="PFA"
                    icon={Table}
                    active={appMode === 'pfa-master'}
                    onClick={() => setAppMode('pfa-master')}
                    isNavOpen={isNavOpen}
                  />
                  <MenuItem
                    label="Source"
                    icon={Box}
                    active={appMode === 'source-master'}
                    onClick={() => setAppMode('source-master')}
                    isNavOpen={isNavOpen}
                  />
                </>
              )}

              {/* Logs Section - Permission-gated */}
              {canAccessAnyScreen([
                'screen_AuditSearch', 'screen_RoleDrift', 'screen_AiUsageLogs',
                'screen_SyncLogs', 'screen_SyncHealth',
              ]) && (
                <>
                  <MenuHeader label="Logs" isNavOpen={isNavOpen} />
                  {canAccessScreen('screen_AuditSearch') && (
                    <MenuItem
                      label="Audit Search"
                      icon={Search}
                      active={appMode === 'audit-search'}
                      onClick={() => setAppMode('audit-search')}
                      isNavOpen={isNavOpen}
                    />
                  )}
                  {canAccessScreen('screen_RoleDrift') && (
                    <MenuItem
                      label="Role Drift"
                      icon={TrendingUp}
                      active={appMode === 'role-drift'}
                      onClick={() => setAppMode('role-drift')}
                      isNavOpen={isNavOpen}
                    />
                  )}
                  {canAccessScreen('screen_AiUsageLogs') && (
                    <MenuItem
                      label="AI Usage"
                      icon={Brain}
                      active={appMode === 'ai-usage-logs'}
                      onClick={() => setAppMode('ai-usage-logs')}
                      isNavOpen={isNavOpen}
                    />
                  )}
                  {canAccessScreen('screen_SyncLogs') && (
                    <MenuItem
                      label="Data Sync"
                      icon={Activity}
                      active={appMode === 'sync-logs'}
                      onClick={() => setAppMode('sync-logs')}
                      isNavOpen={isNavOpen}
                    />
                  )}
                  {canAccessScreen('screen_SyncHealth') && (
                    <MenuItem
                      label="Sync Health"
                      icon={HeartPulse}
                      active={appMode === 'sync-health'}
                      onClick={() => setAppMode('sync-health')}
                      isNavOpen={isNavOpen}
                    />
                  )}
                </>
              )}

              {/* BEO Intelligence - requires AI features permission AND screen access */}
              {currentUser.permissions?.includes('perm_UseAiFeatures') && canAccessAnyScreen([
                'screen_NarrativeReader', 'screen_ArbitrageOpportunities',
                'screen_VendorPricing', 'screen_ScenarioBuilder',
              ]) && (
                <>
                  <MenuHeader label="BEO Intelligence" isNavOpen={isNavOpen} />
                  {canAccessScreen('screen_NarrativeReader') && (
                    <MenuItem
                      label="Narrative Reports"
                      icon={BookOpen}
                      active={appMode === 'narrative-reader'}
                      onClick={() => setAppMode('narrative-reader')}
                      isNavOpen={isNavOpen}
                    />
                  )}
                  {canAccessScreen('screen_ArbitrageOpportunities') && (
                    <MenuItem
                      label="Arbitrage Opportunities"
                      icon={TrendingDown}
                      active={appMode === 'arbitrage-opportunities'}
                      onClick={() => setAppMode('arbitrage-opportunities')}
                      isNavOpen={isNavOpen}
                    />
                  )}
                  {canAccessScreen('screen_VendorPricing') && (
                    <MenuItem
                      label="Vendor Pricing"
                      icon={DollarSign}
                      active={appMode === 'vendor-pricing'}
                      onClick={() => setAppMode('vendor-pricing')}
                      isNavOpen={isNavOpen}
                    />
                  )}
                  {canAccessScreen('screen_ScenarioBuilder') && (
                    <MenuItem
                      label="Scenario Simulator"
                      icon={Zap}
                      active={appMode === 'scenario-builder'}
                      onClick={() => setAppMode('scenario-builder')}
                      isNavOpen={isNavOpen}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="p-3 border-t border-slate-800 bg-slate-900/50 flex-none">
          <div
            className={`flex items-center gap-3 p-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer group ${isNavOpen ? '' : 'justify-center'}`}
            onClick={() => setShowProfile(true)}
          >
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden flex-none ring-2 ring-transparent group-hover:ring-blue-500 transition-all">
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt="User"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-xs font-bold text-slate-400">
                  {currentUser.username[0].toUpperCase()}
                </div>
              )}
            </div>
            <div
              className={`flex-1 min-w-0 transition-opacity duration-300 ${isNavOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}
            >
              <div className="text-xs font-bold text-white truncate">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-slate-400 truncate capitalize">
                {currentUser.role}
              </div>
            </div>
            {isNavOpen && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogout();
                }}
                className="text-slate-500 hover:text-red-400 transition-colors"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
