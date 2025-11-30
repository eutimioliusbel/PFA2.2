import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { KpiBoard } from './components/KpiBoard';
import { FilterPanel } from './components/FilterPanel';
import { CommandDeck } from './components/CommandDeck';
import { SettingsPanel } from './components/SettingsPanel';
import { NewForecastForm } from './components/NewForecastForm';
import { UserProfileModal } from './components/UserProfileModal';
import { AiAssistant } from './components/AiAssistant';
import { LoginScreen } from './components/LoginScreen';
import { useAuth } from './contexts/AuthContext';
import { usePfaData, useSavePfaDraft, useCommitPfaChanges } from './hooks/usePfaData';
import { useAppState } from './hooks/useAppState';
import { useOrgViewSettings } from './hooks/useOrgViewSettings';
import { usePfaDataSync } from './hooks/usePfaDataSync';
import { useFilteredRecords } from './hooks/useFilteredRecords';
import { useFilters } from './hooks/useFilters';
import { useTheme } from './hooks/useTheme';
import { useDraftManagement } from './hooks/useDraftManagement';
import { useUpdateHandlers } from './hooks/useUpdateHandlers';
import { useComputedPfaData } from './hooks/useComputedPfaData';
import { useDataImport } from './hooks/useDataImport';
import { useNavigation } from './hooks/useNavigation';
import { useStaticDataLoader } from './hooks/useStaticDataLoader';
import { usePfaRecordUpdate } from './hooks/usePfaRecordUpdate';
import { useAuthUserMapping } from './hooks/useAuthUserMapping';
import { useUserOrganizations } from './hooks/useUserOrganizations';
import { useAdminMetaState } from './hooks/useAdminMetaState';
import { useAuthActions } from './hooks/useAuthActions';
import { useAppUIState } from './hooks/useAppUIState';
import { usePfaDataState } from './hooks/usePfaDataState';

import { SyncStatusBanner } from './components/SyncStatusBanner';
import { PermissionLoadingSkeleton } from './components/permissions/PermissionLoadingSkeleton';
import { PermissionErrorToast } from './components/permissions/PermissionErrorToast';
import { ImpersonationBanner } from './components/ImpersonationBanner';
import { apiClient } from './services/apiClient';

// Route Rendering Component (Phase 1A Refactoring)
import { AppRoutes } from './components/AppRoutes';
import { MainSidebar } from './components/MainSidebar';
import { FloatingActionButtons } from './components/FloatingActionButtons';
import { LoadingOverlay } from './components/LoadingOverlay';

import { User } from './types';
import { PanelLeftOpen, AlertTriangle, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  // --- Auth State (from Context) ---
  const { user: authUser, isAuthenticated, logout: authLogout, isLoading: authLoading } = useAuth();

  // Map backend user to app user format (Phase 6: Refactoring)
  const { currentUser, setCurrentUser } = useAuthUserMapping({ authUser });

  // --- Consolidated State (Phase 1B: Refactoring) ---
  // App-level state (UI, selection, drafts, history)
  const appState = useAppState();
  const {
    appMode,
    setAppMode,
    isNavOpen,
    toggleNavigation,
    isFilterOpen,
    toggleFilter,
    showSettings,
    setShowSettings,
    showProfile,
    setShowProfile,
    aiMode,
    setAiMode,
    showNewForecastModal,
    setShowNewForecastModal,
    selectedIds,
    toggleSelection,
    selectMultiple,
    clearSelection,
    focusMode,
    setFocusMode,
    pendingModifications,
    sessionId,
    hasUnsavedChanges,
    addMultipleModifications,
    clearModifications,
    getModificationsArray,
    commitHistory,
    undoHistory,
    redoHistory,
    resetHistory,
  } = appState;

  // Organization-specific view settings and filters
  const currentOrgId = currentUser?.organizationId || '';
  const {
    scale,
    zoomLevel,
    barDisplayMode,
    visibleSeries,
    gridColumns,
    grouping,
    colors,
    kpiCompact,
    setScale,
    setZoomLevel,
    setBarDisplayMode,
    setVisibleSeries,
    setGridColumns,
    setGrouping,
    setColors,
    setKpiCompact,
    getOrgFilters,
    setOrgFilters,
  } = useOrgViewSettings(currentOrgId);

  // --- UI State (Phase 6: Refactoring) ---
  const { dragOverrides, setDragOverrides, newForecastInitialValues, setNewForecastInitialValues, permissionError, setPermissionError, isSubmitting, setIsSubmitting, loadingMessage, setLoadingMessage, remountKey, setRemountKey } = useAppUIState();

  // --- PFA Data State (Phase 6: Refactoring) ---
  const { allPfaRef, baselinePfaRef, visiblePfaRecords, setVisiblePfaRecords, visibleBaselinePfaRecords, setVisibleBaselinePfaRecords, dataVersion, setDataVersion, isLoadingData, setIsLoadingData, dataError, setDataError, syncState } = usePfaDataState();

  // --- Admin / Meta Data State (Phase 6: Refactoring) ---
  const { users, setUsers, orgs, setOrgs, refreshOrgs, apis, systemConfig, setSystemConfig, exportConfig, setExportConfig } = useAdminMetaState();

  // --- Master Data State (Phase 6: Refactoring) ---
  const { assetMasterData, setAssetMasterData, classificationData, setClassificationData, dorData, sourceData, manufacturerData, modelData, areaSiloData } = useStaticDataLoader();

  // --- Impersonation State (ADR-005: View As) ---
  const [, setIsImpersonating] = useState(false);

  // Check if current user can impersonate
  const canImpersonate = useMemo(() => {
    if (!authUser) return false;
    return authUser.organizations.some(org => org.permissions?.perm_Impersonate === true);
  }, [authUser]);

  // Handle starting impersonation
  const handleStartImpersonation = useCallback(async (userId: string) => {
    try {
      const result = await apiClient.startImpersonation(userId);
      if (result.success) {
        setIsImpersonating(true);
        // Reload the page to refresh all data with new token
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to start impersonation:', error);
      throw error;
    }
  }, []);

  // Handle ending impersonation
  const handleEndImpersonation = useCallback(async () => {
    try {
      const result = await apiClient.endImpersonation();
      if (result.success) {
        setIsImpersonating(false);
        // Reload the page to refresh all data with original token
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to end impersonation:', error);
      throw error;
    }
  }, []);

  // Check impersonation status on mount
  useEffect(() => {
    const checkImpersonationStatus = async () => {
      try {
        const status = await apiClient.getImpersonationStatus();
        setIsImpersonating(status.isImpersonating);
      } catch {
        // Ignore errors - user might not be authenticated yet
      }
    };
    if (isAuthenticated) {
      checkImpersonationStatus();
    }
  }, [isAuthenticated]);

  // TanStack Query for PFA data with automatic caching
  const currentOrgFilters = currentUser?.organizationId
    ? getOrgFilters(currentUser.organizationId)
    : undefined;

  const {
    data: pfaQueryData,
    isLoading: isPfaQueryLoading,
    error: pfaQueryError,
    refetch: refetchPfaData,
  } = usePfaData(currentUser?.organizationId || '', currentOrgFilters, {
    enabled: !!currentUser?.organizationId,
  });

  // Sync TanStack Query data to refs and state
  usePfaDataSync({
    pfaQueryData,
    isPfaQueryLoading,
    pfaQueryError,
    allPfaRef,
    baselinePfaRef,
    setDataVersion,
    setIsLoadingData,
    setDataError,
    clearModifications,
    resetHistory,
  });

  // Mutation hooks for save/commit with optimistic updates
  const { mutate: saveDraftMutation } =
    useSavePfaDraft(currentUser?.organizationId || '');

  const { mutate: commitChangesMutation } =
    useCommitPfaChanges(currentUser?.organizationId || '');

  // Filter management with derived master data
  const { derivedFilters, filters, handleSetFilters } = useFilters({
    currentOrgId,
    classificationData,
    dorData,
    sourceData,
    manufacturerData,
    modelData,
    allPfaRecords: allPfaRef.current,
    dataVersion,
    getOrgFilters,
    setOrgFilters,
  });

  // Apply theme and filter records
  useTheme({ currentUser, systemConfig });
  useFilteredRecords({
    allPfaRef,
    baselinePfaRef,
    dataVersion,
    filters,
    focusMode,
    selectedIds,
    currentOrganizationId: currentUser?.organizationId,
    setVisiblePfaRecords,
    setVisibleBaselinePfaRecords,
  });

  // User organizations and computed PFA data
  const { userAllowedOrgs, activeOrg } = useUserOrganizations({ currentUser, orgs });
  const { livePfaRecords, bounds } = useComputedPfaData({
    visiblePfaRecords,
    dragOverrides,
  });

  // Navigation, data import, and record updates
  const { handleSwitchContext, handleNavigateToOrganization } = useNavigation({
    currentUser,
    setCurrentUser,
    setUsers,
    setAppMode,
    clearSelection,
  });

  const { updatePfaRecords } = usePfaRecordUpdate({
    allPfaRef,
    baselinePfaRef,
    commitHistory,
    addMultipleModifications,
    setDataVersion,
  });

  const { handleDataImport } = useDataImport({
    exportConfig,
    setIsSubmitting,
    setLoadingMessage,
    updatePfaRecords,
    setAssetMasterData,
    setClassificationData,
    setUsers,
    setOrgs,
  });
  const { handleBulkUpdate, handleUpdateAsset, handleUpdateAssets } =
    useUpdateHandlers({
      allPfaRef,
      undoHistory,
      redoHistory,
      updatePfaRecords,
      setDataVersion,
    });

  const { handleSaveDraft, handleSubmitChanges, handleDiscardChanges } = useDraftManagement({
    currentUser,
    sessionId,
    pendingModifications,
    getModificationsArray,
    saveDraftMutation,
    commitChangesMutation,
    refetchPfaData,
    clearModifications,
    clearSelection,
    setDragOverrides,
    setRemountKey,
    setIsSubmitting,
    setLoadingMessage,
    setPermissionError,
    allPfaRef,
    baselinePfaRef,
  });
  const { handleLogout } = useAuthActions({
    authLogout,
    setShowProfile,
    setShowSettings,
    setAiMode,
  });

  // Show loading screen while checking authentication and loading permissions
  if (authLoading) {
    return <PermissionLoadingSkeleton message="Verifying credentials and loading permissions..." />;
  }

  if (!isAuthenticated || !currentUser) {
    return <LoginScreen config={systemConfig} />;
  }

  const isLabView = ['timeline-lab', 'matrix-lab', 'grid-lab', 'pfa-1.0-lab'].includes(appMode);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
        {/* ADR-005: Impersonation Banner - Shows when admin is viewing as another user */}
        <ImpersonationBanner onEndImpersonation={handleEndImpersonation} />

        <MainSidebar
          isNavOpen={isNavOpen}
          toggleNavigation={toggleNavigation}
          appMode={appMode}
          setAppMode={setAppMode}
          currentUser={currentUser}
          userAllowedOrgs={userAllowedOrgs}
          handleSwitchContext={handleSwitchContext}
          setShowProfile={setShowProfile}
          handleLogout={handleLogout}
        />

        <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 relative h-full overflow-hidden">
            
            <Header
                onOpenSettings={() => setShowSettings(true)}
                onOpenProfile={() => setShowProfile(true)}
                appName="PFA Vanguard"
                org={activeOrg}
                user={currentUser}
                showBranding={false}
                showUserProfile={false}
                hideSettings={['pfa-master', 'asset-master', 'class-master', 'dor-master', 'source-master', 'manufacturer-master', 'model-master', 'ai-usage-logs', 'sync-logs', 'sync-health'].includes(appMode)}
            />

            {isLabView && (
                <SyncStatusBanner
                    syncState={syncState}
                    onRefresh={() => refetchPfaData()}
                    isLoading={isLoadingData}
                />
            )}

            <AiAssistant 
                mode={aiMode}
                onClose={() => setAiMode('hidden')}
                org={activeOrg}
                assets={visiblePfaRecords}
                onApplyUpdates={handleBulkUpdate}
                onApplyFilter={(newFilters) => handleSetFilters(prev => ({ ...prev, ...newFilters }))}
                systemConfig={systemConfig}
                apis={apis}
            />

            <SettingsPanel 
                isOpen={showSettings} onClose={() => setShowSettings(false)}
                appMode={appMode}
                scale={scale} setScale={setScale}
                visibleSeries={visibleSeries} setVisibleSeries={setVisibleSeries}
                barDisplayMode={barDisplayMode} setBarDisplayMode={setBarDisplayMode}
                viewMode={appMode === 'timeline-lab' ? 'timeline' : 'matrix'}
                gridColumns={gridColumns} setGridColumns={setGridColumns}
                grouping={grouping} setGrouping={setGrouping}
                colors={colors} setColors={setColors}
            />

            {isLabView && (
                <div className="flex-none px-4 py-2 z-30">
                    <KpiBoard committedAssets={visibleBaselinePfaRecords} assets={livePfaRecords} compact={kpiCompact} onToggleCompact={() => setKpiCompact(!kpiCompact)} scale={scale} />
                </div>
            )}

            <div className="flex-1 overflow-hidden flex relative">
                
                {isLabView && (
                    <>
                        <aside className={`${isFilterOpen ? 'w-72 translate-x-0 flex-none' : 'w-0 -translate-x-full flex-none'} overflow-hidden bg-white dark:bg-slate-900 flex flex-col border-r border-slate-200 dark:border-slate-700 transition-all duration-300 z-50 flex-none shadow-xl`}>
                            <FilterPanel 
                                filters={filters} setFilters={handleSetFilters}
                                availableCategories={derivedFilters.availableCategories} availableClasses={derivedFilters.availableClasses} availableSources={derivedFilters.availableSources} availableDors={derivedFilters.availableDors} availableAreas={derivedFilters.availableAreas}
                                availableManufacturers={derivedFilters.availableManufacturers} availableModels={derivedFilters.availableModels}
                                collapsed={false} 
                                selectedCount={selectedIds.size} focusMode={focusMode} onToggleFocus={() => setFocusMode(!focusMode)}
                                viewMode={appMode === 'timeline-lab' ? 'timeline' : 'matrix'}
                                zoomLevel={zoomLevel} setZoomLevel={setZoomLevel} onZoomIn={() => setZoomLevel(z => Math.min(3, z * 1.2))} onZoomOut={() => setZoomLevel(z => Math.max(0.5, z / 1.2))}
                                scale={scale}
                                onClose={toggleFilter}
                            />
                        </aside>
                        
                        {/* Floating Open Toggle - Fixed Z-Index and Positioning */}
                        {!isFilterOpen && (
                            <div className="absolute left-0 top-4 z-50">
                                <button
                                    onClick={toggleFilter}
                                    className="p-3 bg-blue-600 rounded-r-xl shadow-lg text-white hover:bg-blue-500 transition-transform hover:scale-105 flex items-center justify-center"
                                >
                                    <PanelLeftOpen className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </>
                )}

                <div className={isLabView ? "flex-1 h-full p-2 pl-0 overflow-hidden relative flex flex-col" : "flex-1 h-full p-6 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950"} key={remountKey}>
                    {isLoadingData && (
                        <div className="flex items-center justify-center h-full">
                            <div className="flex flex-col items-center gap-4">
                                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                                <p className="text-slate-600 dark:text-slate-400 font-medium">Loading PFA data...</p>
                            </div>
                        </div>
                    )}

                    {!isLoadingData && dataError && (
                        <div className="flex items-center justify-center h-full">
                            <div className="max-w-md w-full p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 flex-none mt-0.5" />
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">Failed to Load Data</h3>
                                        <p className="text-red-700 dark:text-red-300 mb-4">{dataError}</p>
                                        <button
                                            onClick={() => refetchPfaData()}
                                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors font-medium"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <AppRoutes
                        appMode={appMode}
                        setAppMode={setAppMode}
                        isLoadingData={isLoadingData}
                        dataError={dataError}
                        visiblePfaRecords={visiblePfaRecords}
                        handleUpdateAsset={handleUpdateAsset}
                        handleUpdateAssets={handleUpdateAssets}
                        updatePfaRecords={updatePfaRecords}
                        setDragOverrides={setDragOverrides}
                        scale={scale}
                        setScale={setScale}
                        zoomLevel={zoomLevel}
                        barDisplayMode={barDisplayMode}
                        visibleSeries={visibleSeries}
                        selectedIds={selectedIds}
                        toggleSelection={toggleSelection}
                        selectMultiple={selectMultiple}
                        gridColumns={gridColumns}
                        colors={colors}
                        bounds={bounds}
                        setNewForecastInitialValues={setNewForecastInitialValues}
                        setShowNewForecastModal={setShowNewForecastModal}
                        assetMasterData={assetMasterData}
                        classificationData={classificationData}
                        allPfaRef={allPfaRef}
                        baselinePfaRef={baselinePfaRef}
                        exportConfig={exportConfig}
                        setExportConfig={setExportConfig}
                        users={users}
                        setUsers={setUsers}
                        orgs={orgs}
                        refreshOrgs={refreshOrgs}
                        currentUser={currentUser}
                        activeOrg={activeOrg}
                        handleDataImport={handleDataImport}
                        dorData={dorData}
                        sourceData={sourceData}
                        manufacturerData={manufacturerData}
                        modelData={modelData}
                        areaSiloData={areaSiloData}
                        systemConfig={systemConfig}
                        setSystemConfig={setSystemConfig}
                        onNavigateToOrganization={handleNavigateToOrganization}
                        onStartImpersonation={handleStartImpersonation}
                        canImpersonate={canImpersonate}
                    />
                </div>

                {isLabView && (
                    <CommandDeck 
                        selectedCount={selectedIds.size} selectedAssets={visiblePfaRecords.filter(a => selectedIds.has(a.id))}
                        scale={scale} 
                        availableCategories={derivedFilters.availableCategories} 
                        availableDors={derivedFilters.availableDors} 
                        assetMaster={assetMasterData}
                        onResetSelected={() => updatePfaRecords(prev => prev.map(a => selectedIds.has(a.id) ? {...a, forecastStart: a.originalStart, forecastEnd: a.originalEnd} : a))}
                        onShiftTime={(d) => updatePfaRecords(prev => prev.map(a => selectedIds.has(a.id) ? {...a, forecastStart: new Date(a.forecastStart.getTime() + d*86400000), forecastEnd: new Date(a.forecastEnd.getTime() + d*86400000)} : a))}
                        onAdjustDuration={(d) => updatePfaRecords(prev => prev.map(a => selectedIds.has(a.id) ? {...a, forecastEnd: new Date(a.forecastEnd.getTime() + d*86400000)} : a))}
                        onBulkUpdate={(u) => updatePfaRecords(prev => prev.map(a => selectedIds.has(a.id) ? {...a, ...u} : a))}
                    />
                )}

                {isLabView && (
                  <FloatingActionButtons
                    hasUnsavedChanges={hasUnsavedChanges}
                    isSubmitting={isSubmitting}
                    pendingModificationsCount={pendingModifications.size}
                    aiMode={aiMode}
                    setAiMode={setAiMode}
                    setShowNewForecastModal={setShowNewForecastModal}
                    handleSaveDraft={handleSaveDraft}
                    handleDiscardChanges={handleDiscardChanges}
                    handleSubmitChanges={handleSubmitChanges}
                  />
                )}
            </div>
        </div>

        {showNewForecastModal && (
            <NewForecastForm 
                onClose={() => { setShowNewForecastModal(false); setNewForecastInitialValues(undefined); }}
                existingCount={allPfaRef.current.length}
                initialValues={newForecastInitialValues}
                onSave={(newAssets) => updatePfaRecords(prev => [...prev, ...newAssets])}
                classificationData={classificationData}
            />
        )}

        {showProfile && currentUser && (
            <UserProfileModal 
                user={currentUser}
                currentUser={currentUser}
                orgs={orgs}
                onClose={() => setShowProfile(false)}
                onSave={(u: Partial<User>) => {
                    const updated = { ...currentUser, ...u } as User;
                    setCurrentUser(updated);
                    setUsers(prev => prev.map(usr => usr.id === updated.id ? updated : usr));
                }}
            />
        )}

        <LoadingOverlay isVisible={isSubmitting} message={loadingMessage} />

        {permissionError && (
            <PermissionErrorToast
                error={permissionError}
                onClose={() => setPermissionError(null)}
            />
        )}

    </div>
  );
};

export default App;
