
import React, { useState } from 'react';
import { User, Organization, ApiConfig, SystemConfig, DataExchangeConfig, Asset, AssetMasterRecord, ClassificationRecord, DorRecord, SourceRecord, ManufacturerRecord, ModelRecord } from '../types';
import { OrgManager } from './admin/OrgManager';
import { UserManager } from './admin/UserManager';
import { ApiManager } from './admin/ApiManager';
import { ApiConnectivity } from './admin/ApiConnectivity';
import { SystemManager } from './admin/SystemManager';
import { DataImporter } from './admin/DataImporter';
import { FieldConfigManager } from './admin/FieldConfigManager';
import { AssetMasterView } from './admin/AssetMasterView';
import { ClassificationView } from './admin/ClassificationView';
import { PfaMasterView } from './admin/PfaMasterView';
import { GenericMasterView } from './admin/GenericMasterView';
import { DataSourceManager } from './admin/DataSourceManager';
import { Users, Building2, Plug, LogOut, Settings, Activity, FileSpreadsheet, FileText, User as UserIcon, Database, FileDown, PanelLeftClose, PanelLeftOpen, Monitor, Tag, Table, Layers, Truck, Factory, Box } from 'lucide-react';

interface AdminDashboardProps {
  currentUser: User;
  onLogout: () => void;
  onLaunchLab: () => void;
  onOpenProfile?: () => void;
  // Shared State for Management
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  orgs: Organization[];
  setOrgs: React.Dispatch<React.SetStateAction<Organization[]>>;
  apis: ApiConfig[];
  setApis: React.Dispatch<React.SetStateAction<ApiConfig[]>>;
  systemConfig: SystemConfig;
  setSystemConfig: (config: SystemConfig) => void;
  exportConfig: DataExchangeConfig;
  setExportConfig: (config: DataExchangeConfig) => void;
  onImportExcel: (file: File, type: string) => void;
  assets: Asset[];
  // New Master Data
  assetMasterData: AssetMasterRecord[];
  classificationData: ClassificationRecord[];
  dorData?: DorRecord[];
  sourceData?: SourceRecord[];
  manufacturerData?: ManufacturerRecord[];
  modelData?: ModelRecord[];
  // AI Helpers
  onGenerateAiIcon?: (context: string, type: 'Org' | 'User' | 'Class' | 'Category') => Promise<string | null>;
  onUpdateClassification?: (id: string, updates: Partial<ClassificationRecord>) => void;
  onBulkGenerateIcons?: () => void;
}

type AdminView = 'users' | 'orgs' | 'apis' | 'system' | 'import' | 'export' | 'asset_master' | 'class_master' | 'pfa_master' | 'dors' | 'sources' | 'manufacturers' | 'models' | 'data_sources';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
    currentUser, onLogout, onLaunchLab, onOpenProfile,
    users, setUsers, orgs, setOrgs, apis, setApis,
    systemConfig, setSystemConfig, 
    exportConfig, setExportConfig,
    onImportExcel,
    assets,
    assetMasterData,
    classificationData,
    dorData = [], sourceData = [], manufacturerData = [], modelData = [],
    onGenerateAiIcon,
    onUpdateClassification,
    onBulkGenerateIcons
}) => {
  const [activeView, setActiveView] = useState<AdminView>('orgs');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const MenuItem = ({ 
      label, 
      icon: Icon, 
      active = false, 
      onClick,
      variant = 'default'
  }: { 
      label: string, 
      icon: any, 
      active?: boolean, 
      onClick: () => void,
      variant?: 'default' | 'primary'
  }) => (
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group whitespace-nowrap overflow-hidden
            ${variant === 'primary' 
                ? 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20' 
                : active 
                    ? 'bg-slate-800 text-white' 
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
            }
        `}
        title={!isSidebarOpen ? label : ''}
      >
        <Icon className={`w-4 h-4 flex-none ${variant === 'primary' ? 'text-orange-500' : active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
        <span className={`transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>{label}</span>
      </button>
  );

  // Filter APIs for AI Providers to pass to OrgManager
  const aiApis = apis.filter(api => api.usage === 'AI');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex font-sans">
        
        {/* Sidebar - Collapsible */}
        <aside className={`${isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full'} bg-slate-900 text-white flex flex-col flex-none border-r border-slate-800 transition-all duration-300 ease-in-out overflow-hidden relative`}>
            <div className="w-64 flex flex-col h-full">
                {/* Brand */}
                <div className="h-20 flex items-center justify-between px-6 border-b border-slate-800 flex-none">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center flex-none overflow-hidden border border-slate-700">
                            {systemConfig.loginLogoUrl ? (
                                <img src={systemConfig.loginLogoUrl} alt="Logo" className="w-full h-full object-contain" />
                            ) : (
                                <Building2 className="w-5 h-5 text-orange-500" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="font-bold text-sm tracking-tight truncate leading-tight">{systemConfig.appName}</div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Admin Console</div>
                        </div>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                        <PanelLeftClose className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation */}
                <div className="flex-1 overflow-y-auto py-6 px-3 space-y-8 custom-scrollbar">
                    
                    {/* Main Apps */}
                    <div className="space-y-1">
                        <MenuItem 
                            label="Timeline Lab" 
                            icon={Activity} 
                            onClick={onLaunchLab} 
                            variant="primary"
                        />
                        <MenuItem 
                            label="Matrix Lab" 
                            icon={FileSpreadsheet} 
                            onClick={onLaunchLab} 
                        />
                    </div>

                    {/* Admin Section */}
                    <div className="space-y-1">
                        <div className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Administration</div>
                        
                        <MenuItem 
                            label="Organization" 
                            icon={Building2} 
                            active={activeView === 'orgs'}
                            onClick={() => setActiveView('orgs')} 
                        />
                        <MenuItem 
                            label="User Management" 
                            icon={Users} 
                            active={activeView === 'users'}
                            onClick={() => setActiveView('users')} 
                        />
                        <MenuItem
                            label="API Connectivity"
                            icon={Plug}
                            active={activeView === 'apis'}
                            onClick={() => setActiveView('apis')}
                        />
                        <MenuItem
                            label="Data Source Mappings"
                            icon={Layers}
                            active={activeView === 'data_sources'}
                            onClick={() => setActiveView('data_sources')}
                        />

                        <div className="px-3 mt-6 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data & Config</div>

                        <MenuItem 
                            label="Manual Import / Export" 
                            icon={Database} 
                            active={activeView === 'import'}
                            onClick={() => setActiveView('import')} 
                        />
                        <MenuItem 
                            label="PFA Master Data" 
                            icon={Table} 
                            active={activeView === 'pfa_master'}
                            onClick={() => setActiveView('pfa_master')} 
                        />
                        <MenuItem 
                            label="Asset Master" 
                            icon={Monitor} 
                            active={activeView === 'asset_master'}
                            onClick={() => setActiveView('asset_master')} 
                        />
                        <MenuItem 
                            label="Class & Category" 
                            icon={Tag} 
                            active={activeView === 'class_master'}
                            onClick={() => setActiveView('class_master')} 
                        />
                        <MenuItem 
                            label="DOR Master" 
                            icon={Layers} 
                            active={activeView === 'dors'}
                            onClick={() => setActiveView('dors')} 
                        />
                        <MenuItem 
                            label="Sources Master" 
                            icon={Box} 
                            active={activeView === 'sources'}
                            onClick={() => setActiveView('sources')} 
                        />
                        <MenuItem 
                            label="Manufacturers" 
                            icon={Factory} 
                            active={activeView === 'manufacturers'}
                            onClick={() => setActiveView('manufacturers')} 
                        />
                        <MenuItem 
                            label="Models" 
                            icon={Truck} 
                            active={activeView === 'models'}
                            onClick={() => setActiveView('models')} 
                        />
                        <MenuItem 
                            label="Field Configuration" 
                            icon={FileDown} 
                            active={activeView === 'export'}
                            onClick={() => setActiveView('export')} 
                        />
                        <MenuItem 
                            label="System Settings" 
                            icon={Settings} 
                            active={activeView === 'system'}
                            onClick={() => setActiveView('system')} 
                        />
                    </div>
                </div>

                {/* User Footer - Clickable for Profile */}
                <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex-none">
                    <div className="flex items-center gap-2">
                        <div 
                            className="flex-1 flex items-center gap-3 p-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700/80 transition-colors cursor-pointer"
                            onClick={onOpenProfile}
                        >
                            <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center border border-orange-500/30 overflow-hidden flex-none">
                                {currentUser.avatarUrl ? (
                                    <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <UserIcon className="w-4 h-4 text-white" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
                                <div className="text-[10px] text-slate-400 truncate">Administrator</div>
                            </div>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onLogout(); }}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors flex-none"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 relative">
            
            {/* Sidebar Trigger (When Closed) */}
            {!isSidebarOpen && (
                <div className="absolute left-4 top-4 z-50">
                     <button 
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 bg-slate-900 text-white rounded-lg shadow-lg hover:bg-slate-800 transition-colors"
                    >
                        <PanelLeftOpen className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Header */}
            <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 flex-none pl-16">
                 <div>
                     <h2 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-wide">
                        {activeView.replace('_', ' ')}
                     </h2>
                 </div>
            </header>

            {/* Content Scrollable */}
            <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-[95%] mx-auto">
                    {activeView === 'orgs' && <OrgManager orgs={orgs} setOrgs={setOrgs} availableAiApis={aiApis} onGenerateAiLogo={onGenerateAiIcon ? (ctx) => onGenerateAiIcon(ctx, 'Org') : undefined} />}
                    {activeView === 'users' && <UserManager users={users} setUsers={setUsers} orgs={orgs} currentUser={currentUser} onGenerateAiAvatar={onGenerateAiIcon ? (ctx) => onGenerateAiIcon(ctx, 'User') : undefined} />}
                    {activeView === 'apis' && <ApiConnectivity />}
                    {activeView === 'data_sources' && <DataSourceManager />}
                    {activeView === 'system' && <SystemManager config={systemConfig} setConfig={setSystemConfig} />}
                    {activeView === 'import' && <DataImporter onImportExcel={onImportExcel} config={exportConfig} assets={assets} />}
                    {activeView === 'export' && <FieldConfigManager config={exportConfig} setConfig={setExportConfig} />}
                    {activeView === 'asset_master' && <AssetMasterView data={assetMasterData} />}
                    {activeView === 'class_master' && <ClassificationView data={classificationData} onGenerateAiIcon={onGenerateAiIcon ? (ctx) => onGenerateAiIcon(ctx, 'Class') : undefined} onUpdate={onUpdateClassification} onBulkGenerateIcons={onBulkGenerateIcons} />}
                    {activeView === 'pfa_master' && <PfaMasterView assets={assets} />}
                    
                    {/* New Generic Views */}
                    {activeView === 'dors' && (
                        <GenericMasterView 
                            title="DOR Master Data" 
                            description="Division of Responsibility codes." 
                            data={dorData} 
                            columns={[{key:'code', label:'Code', width:'120px'}, {key:'description', label:'Description'}]} 
                            icon={Layers}
                        />
                    )}
                    {activeView === 'sources' && (
                        <GenericMasterView 
                            title="Source Master Data" 
                            description="Funding sources (e.g., Rental vs Purchase)." 
                            data={sourceData} 
                            columns={[{key:'name', label:'Name', width:'200px'}, {key:'type', label:'Type', width:'100px'}]} 
                            icon={Box}
                        />
                    )}
                    {activeView === 'manufacturers' && (
                        <GenericMasterView 
                            title="Manufacturer Master Data" 
                            description="Equipment manufacturers." 
                            data={manufacturerData} 
                            columns={[{key:'name', label:'Name'}]} 
                            icon={Factory}
                        />
                    )}
                    {activeView === 'models' && (
                        <GenericMasterView 
                            title="Model Master Data" 
                            description="Equipment models linked to manufacturers." 
                            data={modelData} 
                            columns={[{key:'name', label:'Name'}, {key:'manufacturerName', label:'Manufacturer'}]} 
                            icon={Truck}
                        />
                    )}
                </div>
            </main>
        </div>
    </div>
  );
};
