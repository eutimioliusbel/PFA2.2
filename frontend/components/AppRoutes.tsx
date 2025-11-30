/**
 * AppRoutes Component
 * Extracted from App.tsx - Phase 1A Large File Refactoring
 *
 * Handles all route rendering logic for the PFA Vanguard application.
 * Renders different views based on appMode state.
 */

import React from 'react';
import { Layers, Box, Factory, Truck, MapPin } from 'lucide-react';
import { TimelineLab } from './TimelineLab';
import { GridLab } from './GridLab';
import { ExportView } from './ExportView';
import { OrganizationManagement } from './admin/OrganizationManagement';
import { ApiConnectivity } from './admin/ApiConnectivity';
import { ApiServerManager } from './admin/ApiServerManager';
import { DataImporter } from './admin/DataImporter';
import { MappingStudioComplete as MappingStudio } from './admin/MappingStudio';
import { PfaMasterView } from './admin/PfaMasterView';
import { AssetMasterView } from './admin/AssetMasterView';
import { ClassificationView } from './admin/ClassificationView';
import { GenericMasterView } from './admin/GenericMasterView';
import { EditableMasterView } from './admin/EditableMasterView';
import { FieldConfigManager } from './admin/FieldConfigManager';
import { apiClient } from '../services/apiClient';
import { SystemManager } from './admin/SystemManager';
import { AiUsageLogsView } from './admin/AiUsageLogsView';
import { SyncLogsView } from './admin/SyncLogsView';
import { SyncHealthDashboard } from './admin/SyncHealthDashboard';
import { UserManagement } from './admin/UserManagement';
import { PortfolioLanding } from './admin/PortfolioLanding';
import { SemanticAuditSearch } from './admin/SemanticAuditSearch';
import { RoleDriftAlerts } from './admin/RoleDriftAlerts';
import { RoleTemplateEditor } from './admin/RoleTemplateEditor';
import { NotificationPreferences } from './settings/NotificationPreferences';
import { NotificationEventConfig } from './admin/NotificationEventConfig';
import { ApprovalQueue } from './admin/ApprovalQueue';
import { NarrativeReader } from './beo/NarrativeReader';
import { ArbitrageOpportunities } from './beo/ArbitrageOpportunities';
import { VendorPricingDashboard } from './beo/VendorPricingDashboard';
import { ScenarioBuilder } from './beo/ScenarioBuilder';
import { VoiceAnalyst } from './beo/VoiceAnalyst';
import type {
  PfaView,
  AppMode,
  User,
  Organization,
  DataExchangeConfig,
  SystemConfig,
  GridColumn,
  ColorConfig,
  TimelineBounds,
  Scale,
  DisplayMetric,
  SeriesVisibility,
} from '../types';

export interface AppRoutesProps {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  isLoadingData: boolean;
  dataError: string | null;
  visiblePfaRecords: PfaView[];
  handleUpdateAsset: (id: string, start: Date, end: Date, layer: 'forecast' | 'actual') => void;
  handleUpdateAssets: (updates: { id: string; start: Date; end: Date; layer: 'forecast' | 'actual' }[]) => void;
  updatePfaRecords: (fn: (assets: PfaView[]) => PfaView[]) => void;
  setDragOverrides: React.Dispatch<React.SetStateAction<Map<string, { start: Date; end: Date; layer: 'forecast' | 'actual' }> | null>>;
  scale: Scale;
  setScale: (scale: Scale) => void;
  zoomLevel: number;
  barDisplayMode: DisplayMetric;
  visibleSeries: SeriesVisibility;
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
  selectMultiple: (ids: string[], selected: boolean) => void;
  gridColumns: GridColumn[];
  colors: ColorConfig;
  bounds: TimelineBounds;
  setNewForecastInitialValues: (values: any) => void;
  setShowNewForecastModal: (show: boolean) => void;
  assetMasterData: any[];
  classificationData: any[];
  allPfaRef: React.MutableRefObject<PfaView[]>;
  baselinePfaRef: React.MutableRefObject<PfaView[]>;
  exportConfig: DataExchangeConfig;
  setExportConfig: (config: DataExchangeConfig) => void;
  users: User[];
  setUsers: (users: User[]) => void;
  orgs: Organization[];
  refreshOrgs?: () => Promise<void>;
  currentUser: User;
  activeOrg: Organization;
  handleDataImport: (file: File, type: string) => Promise<void>;
  dorData: any[];
  sourceData: any[];
  manufacturerData: any[];
  modelData: any[];
  areaSiloData: any[];
  systemConfig: SystemConfig;
  setSystemConfig: (config: SystemConfig) => void;
  onNavigateToOrganization: (organizationId: string) => void;
  refreshMasterData?: () => Promise<void>;
  canEditMasterData?: boolean;
  // Impersonation (ADR-005: View As)
  onStartImpersonation?: (userId: string) => Promise<void>;
  canImpersonate?: boolean;
}

export const AppRoutes: React.FC<AppRoutesProps> = ({
  appMode,
  setAppMode,
  isLoadingData,
  dataError,
  visiblePfaRecords,
  handleUpdateAsset,
  handleUpdateAssets,
  updatePfaRecords,
  setDragOverrides,
  scale,
  setScale,
  zoomLevel,
  barDisplayMode,
  visibleSeries,
  selectedIds,
  toggleSelection,
  selectMultiple,
  gridColumns,
  colors,
  bounds,
  setNewForecastInitialValues,
  setShowNewForecastModal,
  assetMasterData,
  classificationData,
  allPfaRef,
  baselinePfaRef,
  exportConfig,
  setExportConfig,
  users: _users,
  setUsers: _setUsers,
  orgs,
  refreshOrgs,
  currentUser,
  activeOrg,
  handleDataImport,
  dorData,
  sourceData,
  manufacturerData,
  modelData,
  areaSiloData,
  systemConfig,
  setSystemConfig,
  onNavigateToOrganization,
  refreshMasterData,
  canEditMasterData = false,
  onStartImpersonation,
  canImpersonate = false,
}) => {
  // Lab Views - Timeline Lab
  if (!isLoadingData && !dataError && appMode === 'timeline-lab') {
    return (
      <TimelineLab
        pfaRecords={visiblePfaRecords}
        onUpdateAsset={handleUpdateAsset}
        onUpdateAssets={handleUpdateAssets}
        onUpdateAssetRate={(id, r) =>
          updatePfaRecords((prev) =>
            prev.map((a) =>
              a.id === id
                ? a.source === 'Purchase'
                  ? { ...a, purchasePrice: r }
                  : { ...a, monthlyRate: r }
                : a
            )
          )
        }
        onUpdateAssetStatus={(id, s) =>
          updatePfaRecords((prev) =>
            prev.map((a) => (a.id === id ? { ...a, isActualized: s } : a))
          )
        }
        onUpdateAssetEquipment={(id, e) =>
          updatePfaRecords((prev) =>
            prev.map((a) => (a.id === id ? { ...a, equipment: e } : a))
          )
        }
        onDragChange={setDragOverrides}
        viewMode="timeline"
        scale={scale}
        setScale={setScale}
        zoomLevel={zoomLevel}
        barDisplayMode={barDisplayMode}
        visibleSeries={visibleSeries}
        selectedIds={selectedIds}
        onToggleSelection={toggleSelection}
        onSelectMultiple={selectMultiple}
        gridColumns={gridColumns}
        colors={colors}
        bounds={bounds}
        onInitiateAddForecast={(vals: Record<string, unknown>) => {
          setNewForecastInitialValues(vals);
          setShowNewForecastModal(true);
        }}
        assetMaster={assetMasterData}
        classificationData={classificationData}
      />
    );
  }

  // Lab Views - Matrix Lab
  if (!isLoadingData && !dataError && appMode === 'matrix-lab') {
    return (
      <TimelineLab
        pfaRecords={visiblePfaRecords}
        onUpdateAsset={handleUpdateAsset}
        onUpdateAssets={handleUpdateAssets}
        onUpdateAssetRate={(id, r) =>
          updatePfaRecords((prev) =>
            prev.map((a) =>
              a.id === id
                ? a.source === 'Purchase'
                  ? { ...a, purchasePrice: r }
                  : { ...a, monthlyRate: r }
                : a
            )
          )
        }
        onUpdateAssetStatus={(id, s) =>
          updatePfaRecords((prev) =>
            prev.map((a) => (a.id === id ? { ...a, isActualized: s } : a))
          )
        }
        onUpdateAssetEquipment={(id, e) =>
          updatePfaRecords((prev) =>
            prev.map((a) => (a.id === id ? { ...a, equipment: e } : a))
          )
        }
        onDragChange={setDragOverrides}
        viewMode="matrix"
        scale={scale}
        setScale={setScale}
        zoomLevel={zoomLevel}
        barDisplayMode={barDisplayMode}
        visibleSeries={visibleSeries}
        selectedIds={selectedIds}
        onToggleSelection={toggleSelection}
        onSelectMultiple={selectMultiple}
        gridColumns={gridColumns}
        colors={colors}
        bounds={bounds}
        onInitiateAddForecast={(vals: Record<string, unknown>) => {
          setNewForecastInitialValues(vals);
          setShowNewForecastModal(true);
        }}
        assetMaster={assetMasterData}
        classificationData={classificationData}
      />
    );
  }

  // Lab Views - PFA 1.0 Lab (Forces Quantity Matrix View)
  if (!isLoadingData && !dataError && appMode === 'pfa-1.0-lab') {
    return (
      <TimelineLab
        pfaRecords={visiblePfaRecords}
        onUpdateAsset={handleUpdateAsset}
        onUpdateAssets={handleUpdateAssets}
        onUpdateAssetRate={(id, r) =>
          updatePfaRecords((prev) =>
            prev.map((a) =>
              a.id === id
                ? a.source === 'Purchase'
                  ? { ...a, purchasePrice: r }
                  : { ...a, monthlyRate: r }
                : a
            )
          )
        }
        onUpdateAssetStatus={(id, s) =>
          updatePfaRecords((prev) =>
            prev.map((a) => (a.id === id ? { ...a, isActualized: s } : a))
          )
        }
        onUpdateAssetEquipment={(id, e) =>
          updatePfaRecords((prev) =>
            prev.map((a) => (a.id === id ? { ...a, equipment: e } : a))
          )
        }
        onDragChange={setDragOverrides}
        viewMode="matrix"
        scale={scale}
        setScale={setScale}
        zoomLevel={zoomLevel}
        barDisplayMode="quantity"
        visibleSeries={visibleSeries}
        selectedIds={selectedIds}
        onToggleSelection={toggleSelection}
        onSelectMultiple={selectMultiple}
        gridColumns={gridColumns}
        colors={colors}
        bounds={bounds}
        onInitiateAddForecast={(vals: Record<string, unknown>) => {
          setNewForecastInitialValues(vals);
          setShowNewForecastModal(true);
        }}
        assetMaster={assetMasterData}
        classificationData={classificationData}
      />
    );
  }

  // Lab Views - Grid Lab
  if (!isLoadingData && !dataError && appMode === 'grid-lab') {
    return (
      <GridLab
        assets={visiblePfaRecords}
        selectedIds={selectedIds}
        onToggleSelection={toggleSelection}
        onSelectMultiple={selectMultiple}
      />
    );
  }

  // Export View
  if (appMode === 'export') {
    return (
      <ExportView
        assets={allPfaRef.current}
        baselineAssets={baselinePfaRef.current}
      />
    );
  }

  // Admin Screens
  if (appMode === 'organization') {
    return <OrganizationManagement onOrganizationUpdated={refreshOrgs} />;
  }

  if (appMode === 'user-management') {
    return (
      <UserManagement
        onStartImpersonation={onStartImpersonation}
        canImpersonate={canImpersonate}
      />
    );
  }

  if (appMode === 'api-connectivity') {
    return <ApiConnectivity />;
  }

  if (appMode === 'api-servers') {
    return <ApiServerManager organizationId={currentUser.organizationId} />;
  }

  if (appMode === 'data-import') {
    return (
      <DataImporter
        onImportExcel={handleDataImport}
        config={exportConfig}
        assets={allPfaRef.current}
      />
    );
  }

  if (appMode === 'mapping-studio') {
    return <MappingStudio organizationId={currentUser.organizationId} />;
  }

  if (appMode === 'pfa-master') {
    return <PfaMasterView assets={allPfaRef.current} />;
  }

  if (appMode === 'asset-master') {
    return <AssetMasterView data={assetMasterData} />;
  }

  if (appMode === 'class-master') {
    return <ClassificationView data={classificationData} />;
  }

  if (appMode === 'dor-master') {
    return (
      <EditableMasterView
        title="DORs"
        description="Division of Responsibility codes - manage how costs are allocated."
        data={dorData}
        columns={[
          { key: 'code', label: 'Code', width: '120px' },
          { key: 'description', label: 'Description' },
        ]}
        formFields={[
          { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g., BEO, PROJECT' },
          { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Brief description of this DOR' },
        ]}
        icon={Layers}
        onRefresh={refreshMasterData}
        onCreate={async (data) => {
          await apiClient.createDor({ code: String(data.code), description: String(data.description || '') });
        }}
        onUpdate={async (id, data) => {
          await apiClient.updateDor(id, { code: String(data.code), description: String(data.description || '') });
        }}
        onDelete={async (id) => {
          await apiClient.deleteDor(id);
        }}
        canEdit={canEditMasterData || currentUser.role === 'admin'}
      />
    );
  }

  if (appMode === 'source-master') {
    return (
      <EditableMasterView
        title="Sources"
        description="Funding sources define how equipment is procured (Rental, Purchase, Lease)."
        data={sourceData}
        columns={[
          { key: 'code', label: 'Code', width: '120px' },
          { key: 'description', label: 'Description' },
          { key: 'type', label: 'Type', width: '100px' },
        ]}
        formFields={[
          { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g., RENTAL, PURCHASE' },
          { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Brief description' },
          {
            key: 'type',
            label: 'Type',
            type: 'select',
            options: [
              { value: 'Capex', label: 'Capex (Capital Expenditure)' },
              { value: 'Opex', label: 'Opex (Operational Expenditure)' },
            ],
          },
        ]}
        icon={Box}
        onRefresh={refreshMasterData}
        onCreate={async (data) => {
          await apiClient.createSource({
            code: String(data.code),
            description: String(data.description || ''),
            type: data.type as 'Capex' | 'Opex' | undefined,
          });
        }}
        onUpdate={async (id, data) => {
          await apiClient.updateSource(id, {
            code: String(data.code),
            description: String(data.description || ''),
            type: data.type as 'Capex' | 'Opex' | undefined,
          });
        }}
        onDelete={async (id) => {
          await apiClient.deleteSource(id);
        }}
        canEdit={canEditMasterData || currentUser.role === 'admin'}
      />
    );
  }

  if (appMode === 'manufacturer-master') {
    return (
      <GenericMasterView
        title="Manufacturers"
        description="Equipment manufacturers."
        data={manufacturerData}
        columns={[{ key: 'name', label: 'Name' }]}
        icon={Factory}
      />
    );
  }

  if (appMode === 'model-master') {
    return (
      <GenericMasterView
        title="Models"
        description="Equipment models linked to manufacturers."
        data={modelData}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'manufacturerName', label: 'Manufacturer' },
        ]}
        icon={Truck}
      />
    );
  }

  if (appMode === 'area-silo-master') {
    return (
      <GenericMasterView
        title="Area / Silo"
        description="Organization-specific area and silo codes for equipment location tracking."
        data={areaSiloData}
        columns={[
          { key: 'areaSilo', label: 'Area/Silo', width: '200px' },
          { key: 'description', label: 'Description' },
          { key: 'organizationCode', label: 'Organization', width: '150px' },
        ]}
        icon={MapPin}
      />
    );
  }

  if (appMode === 'field-config') {
    return (
      <FieldConfigManager config={exportConfig} setConfig={setExportConfig} />
    );
  }

  if (appMode === 'system-settings') {
    return (
      <SystemManager config={systemConfig} setConfig={setSystemConfig} />
    );
  }

  if (appMode === 'ai-usage-logs') {
    return <AiUsageLogsView organizationId={activeOrg.id} />;
  }

  if (appMode === 'sync-logs') {
    return <SyncLogsView organizationId={activeOrg.id} />;
  }

  if (appMode === 'sync-health') {
    return <SyncHealthDashboard />;
  }

  if (appMode === 'role-templates') {
    return <RoleTemplateEditor />;
  }

  if (appMode === 'beo-glass') {
    return (
      <PortfolioLanding
        currentUser={currentUser}
        onNavigateToOrganization={onNavigateToOrganization}
        onNavigateToBeoTool={(tool) => setAppMode(tool)}
      />
    );
  }

  if (appMode === 'audit-search') {
    return <SemanticAuditSearch />;
  }

  if (appMode === 'role-drift') {
    return <RoleDriftAlerts />;
  }

  if (appMode === 'notification-settings') {
    return <NotificationPreferences />;
  }

  if (appMode === 'notification-events') {
    return <NotificationEventConfig />;
  }

  if (appMode === 'approval-queue') {
    return <ApprovalQueue />;
  }

  // BEO Intelligence Screens - require perm_UseAiFeatures
  const hasAiPermission = currentUser.permissions?.includes('perm_UseAiFeatures');

  if (appMode === 'narrative-reader' || appMode === 'arbitrage-opportunities' ||
      appMode === 'vendor-pricing' || appMode === 'scenario-builder' || appMode === 'voice-analyst') {
    if (!hasAiPermission) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-8 bg-slate-800 rounded-xl max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m4-6V9a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">AI Features Not Enabled</h2>
            <p className="text-slate-400 text-sm">
              This feature requires AI access. Contact your administrator to enable AI features for your account.
            </p>
          </div>
        </div>
      );
    }

    if (appMode === 'voice-analyst') {
      return <VoiceAnalyst onClose={() => setAppMode('beo-glass')} />;
    }
    if (appMode === 'narrative-reader') {
      return <NarrativeReader organizationId={currentUser.organizationId} />;
    }
    if (appMode === 'arbitrage-opportunities') {
      return <ArbitrageOpportunities />;
    }
    if (appMode === 'vendor-pricing') {
      return <VendorPricingDashboard />;
    }
    if (appMode === 'scenario-builder') {
      return (
        <ScenarioBuilder
          organizations={orgs}
          onClose={() => setAppMode('beo-glass')}
        />
      );
    }
  }

  return null;
};
