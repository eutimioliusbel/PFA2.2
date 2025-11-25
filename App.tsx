
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { TimelineLab } from './components/TimelineLab';
import { ExportView } from './components/ExportView';
import { GridLab } from './components/GridLab';
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

// Admin Feature Components
import { OrgManager } from './components/admin/OrgManager';
import { UserManager } from './components/admin/UserManager';
import { ApiManager } from './components/admin/ApiManager';
import { ApiConnectivity } from './components/admin/ApiConnectivity';
import { SystemManager } from './components/admin/SystemManager';
import { DataImporter } from './components/admin/DataImporter';
import { FieldConfigManager } from './components/admin/FieldConfigManager';
import { AssetMasterView } from './components/admin/AssetMasterView';
import { ClassificationView } from './components/admin/ClassificationView';
import { PfaMasterView } from './components/admin/PfaMasterView';
import { GenericMasterView } from './components/admin/GenericMasterView';
import { AiUsageLogsView } from './components/admin/AiUsageLogsView';
import { SyncLogsView } from './components/admin/SyncLogsView';

import { User, Organization, PfaRecord, FilterState, Scale, SeriesVisibility, DisplayMetric, GridColumn, ColorConfig, DataExchangeConfig, ApiConfig, SystemConfig, AssetMasterRecord, ClassificationRecord, DataCategory, DorRecord, SourceRecord, ManufacturerRecord, ModelRecord } from './types';
import { STATIC_PFA_RECORDS, STATIC_ASSET_MASTER, STATIC_CLASSIFICATION, STATIC_DORS, STATIC_SOURCES, STATIC_MANUFACTURERS, STATIC_MODELS } from './mockData';
import { PanelLeftOpen, Plus, Undo2, Redo2, Check, Trash2, AlertTriangle, RefreshCw, Loader2, Sparkles, Mic, X, Save, Brain, Send, Activity, FileSpreadsheet, Database, FileDown, PanelLeftClose, LogOut, Shield, LayoutGrid, Table, Building2, Plug, Settings, Monitor, Tag, Layers, FileText, Users, Blocks, Box, Factory, Truck, ScrollText } from 'lucide-react';
import { getTimelineBounds, getDaysDiff } from './utils';
import { apiClient } from './services/apiClient';

// --- Missing Definitions Restored ---

type AppMode = 'timeline-lab' | 'matrix-lab' | 'grid-lab' | 'pfa-1.0-lab' | 'export' | 'organization' | 'user-management' | 'api-connectivity' | 'data-import' | 'pfa-master' | 'asset-master' | 'class-master' | 'dor-master' | 'source-master' | 'manufacturer-master' | 'model-master' | 'field-config' | 'system-settings' | 'ai-usage-logs' | 'sync-logs';

const MOCK_ORGS: Organization[] = [
  { 
    id: 'HOLNG', 
    name: 'Holcim LNG', 
    status: 'active', 
    aiRules: [], 
    submitMode: 'api', 
    features: { ai: true, aiAccessLevel: 'full-access', aiIconGeneration: true }, 
    permissions: { viewTimeline: true, viewMatrix: true, viewGrid: true, canExport: true },
    headerConfig: { showLogo: true, showId: true, showName: false, showDescription: false }
  },
  { 
    id: 'PEMS_Global', 
    name: 'PEMS Global', 
    status: 'active', 
    aiRules: [], 
    submitMode: 'download', 
    features: { ai: false }, 
    permissions: { viewTimeline: true, viewMatrix: true, viewGrid: true, canExport: true },
    headerConfig: { showLogo: false, showId: false, showName: true, showDescription: true }
  }
];

const MOCK_USERS: User[] = [
  { id: 'u1', username: 'admin', role: 'admin', name: 'System Admin', organizationId: 'HOLNG', allowedOrganizationIds: ['HOLNG', 'PEMS_Global'], themePreference: 'system' },
  { id: 'u2', username: 'user', role: 'user', name: 'John Doe', organizationId: 'HOLNG', allowedOrganizationIds: ['HOLNG'], themePreference: 'light' }
];

const DEFAULT_COLUMNS: GridColumn[] = [
    { id: 'pfaId', label: 'PFA ID', visible: true, width: 100 },
    { id: 'areaSilo', label: 'Area / Silo', visible: true, width: 120 },
    { id: 'class', label: 'Class', visible: true, width: 120 },
    { id: 'category', label: 'Category', visible: true, width: 120 },
    { id: 'source', label: 'Source', visible: true, width: 80 },
    { id: 'dor', label: 'DOR', visible: false, width: 80 },
    { id: 'estimatedStart', label: 'Est. Start', visible: true, width: 100 },
    { id: 'estimatedEnd', label: 'Est. End', visible: true, width: 100 },
    { id: 'ratePrice', label: 'Rate/Price', visible: true, width: 100 },
    { id: 'manufacturer', label: 'Make', visible: false, width: 100 },
    { id: 'model', label: 'Model', visible: false, width: 100 },
    { id: 'isActualized', label: 'Status/Eq', visible: true, width: 120 },
    { id: 'totalCost', label: 'Total Cost', visible: true, width: 100 }
];

const DEFAULT_EXPORT_CONFIG: DataExchangeConfig = {
    fields: {
        forecast_export: [
            { id: 'pfa_id', label: 'PFA ID', internalKey: 'pfaId', enabled: true },
            { id: 'start_date', label: 'Start Date', internalKey: 'forecastStart', enabled: true },
            { id: 'end_date', label: 'End Date', internalKey: 'forecastEnd', enabled: true },
            { id: 'rate', label: 'Monthly Rate', internalKey: 'monthlyRate', enabled: true }
        ],
        actuals_export: [
            { id: 'pfa_id', label: 'PFA ID', internalKey: 'pfaId', enabled: true },
            { id: 'act_start', label: 'Actual Start', internalKey: 'actualStart', enabled: true },
            { id: 'act_end', label: 'Actual End', internalKey: 'actualEnd', enabled: true },
            { id: 'equipment', label: 'Equipment', internalKey: 'equipment', enabled: true }
        ],
        pfa_import: [
             { id: 'pfa_id', label: 'PFA ID', apiMap: 'PFA_ID', internalKey: 'pfaId', enabled: true },
             { id: 'desc', label: 'Class', apiMap: 'CLASS_DESC', internalKey: 'class', enabled: true }
        ],
        assets_import: [],
        class_cat_import: [],
        users_import: [],
        orgs_import: [],
        user_orgs_import: []
    }
};

const cloneAssets = (assets: PfaRecord[]): PfaRecord[] => {
    return assets.map(a => ({
        ...a,
        originalStart: new Date(a.originalStart),
        originalEnd: new Date(a.originalEnd),
        forecastStart: new Date(a.forecastStart),
        forecastEnd: new Date(a.forecastEnd),
        actualStart: new Date(a.actualStart),
        actualEnd: new Date(a.actualEnd)
    }));
};

const parseCSV = (text: string): string[][] => {
    const lines = text.split('\n').filter(l => l.trim());
    return lines.map(line => {
        // This regex handles quoted commas
        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (matches) {
            return matches.map(m => m.replace(/^"|"$/g, '').trim());
        }
        return line.split(',').map(s => s.trim());
    });
};

const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

const createDefaultFilters = (cats: string[], classes: string[], dors: string[], sources: string[], areas: string[]): FilterState => ({
    category: cats,
    classType: classes,
    source: sources,
    dor: dors,
    status: ['Forecast', 'Actuals'],
    areaSilo: areas,
    search: '',
    startDateFrom: '',
    startDateTo: '',
    endDateFrom: '',
    endDateTo: ''
});

const App: React.FC = () => {
  // --- Auth State (from Context) ---
  const { user: authUser, isAuthenticated, logout: authLogout, isLoading: authLoading } = useAuth();

  // Map backend user to app user format (temporary bridge until full migration)
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Sync currentUser with authUser
  useEffect(() => {
    if (authUser) {
      setCurrentUser({
        id: authUser.id,
        username: authUser.username,
        name: `${authUser.firstName || ''} ${authUser.lastName || ''}`.trim() || authUser.username,
        role: authUser.role,
        organizationId: authUser.organizations[0]?.code || 'HOLNG',
        allowedOrganizationIds: authUser.organizations.map(o => o.code),
        themePreference: 'system'
      });
    } else {
      setCurrentUser(null);
    }
  }, [authUser]);

  // --- App State ---
  const [appMode, setAppMode] = useState<AppMode>('timeline-lab');
  const [isNavOpen, setIsNavOpen] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [remountKey, setRemountKey] = useState(0);
  const [aiMode, setAiMode] = useState<'hidden' | 'panel' | 'voice'>('hidden');

  // --- Data State ---
  // Using PfaRecord type
  const allPfaRef = useRef<PfaRecord[]>([]);
  const baselinePfaRef = useRef<PfaRecord[]>([]);
  const [visiblePfaRecords, setVisiblePfaRecords] = useState<PfaRecord[]>([]);
  const [visibleBaselinePfaRecords, setVisibleBaselinePfaRecords] = useState<PfaRecord[]>([]);
  const [dataVersion, setDataVersion] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);

  // --- Admin / Meta Data State ---
  const [users, setUsers] = useState<User[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [apis, setApis] = useState<ApiConfig[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
      appName: 'PFA Vanguard',
      defaultTheme: 'dark',
      loginLogoUrl: '',
      aiGlobalRules: []
  });
  const [exportConfig, setExportConfig] = useState<DataExchangeConfig>(DEFAULT_EXPORT_CONFIG);
  
  // MASTER DATA STATES
  const [assetMasterData, setAssetMasterData] = useState<AssetMasterRecord[]>([]);
  const [classificationData, setClassificationData] = useState<ClassificationRecord[]>([]);
  const [dorData, setDorData] = useState<DorRecord[]>([]);
  const [sourceData, setSourceData] = useState<SourceRecord[]>([]);
  const [manufacturerData, setManufacturerData] = useState<ManufacturerRecord[]>([]);
  const [modelData, setModelData] = useState<ModelRecord[]>([]);

  // --- History Stack ---
  const historyRef = useRef<PfaRecord[][]>([]);
  const futureRef = useRef<PfaRecord[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // --- View Settings ---
  // Store filters per organization ID to maintain unique cockpit state per org
  const [orgSpecificFilters, setOrgSpecificFilters] = useState<Record<string, FilterState>>({});

  const [scale, setScale] = useState<Scale>('Month');
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [barDisplayMode, setBarDisplayMode] = useState<DisplayMetric>('cost');
  const [visibleSeries, setVisibleSeries] = useState<SeriesVisibility>({ plan: true, forecast: true, actual: true });
  const [gridColumns, setGridColumns] = useState<GridColumn[]>(DEFAULT_COLUMNS);
  const [grouping, setGrouping] = useState<any[]>(['category']); // Keep in App for persistence
  const [colors, setColors] = useState<ColorConfig>({ plan: '#e2e8f0', forecast: '#3b82f6', actual: '#22c55e' });
  const [kpiCompact, setKpiCompact] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusMode, setFocusMode] = useState(false);
  const [dragOverrides, setDragOverrides] = useState<Map<string, { start: Date; end: Date; layer: 'forecast' | 'actual' }> | null>(null);
  const [showNewForecastModal, setShowNewForecastModal] = useState(false);
  const [newForecastInitialValues, setNewForecastInitialValues] = useState<any>(undefined);

  // --- Initialization ---
  useEffect(() => {
      // Load STATIC Master Data
      allPfaRef.current = cloneAssets(STATIC_PFA_RECORDS); // Initial Load
      baselinePfaRef.current = cloneAssets(STATIC_PFA_RECORDS);

      setAssetMasterData(STATIC_ASSET_MASTER);
      setClassificationData(STATIC_CLASSIFICATION);
      setDorData(STATIC_DORS);
      setSourceData(STATIC_SOURCES);
      setManufacturerData(STATIC_MANUFACTURERS);
      setModelData(STATIC_MODELS);

      setDataVersion(v => v + 1);
  }, []);

  // --- Fetch Users and Organizations from API ---
  useEffect(() => {
    const fetchUsersAndOrgs = async () => {
      try {
        const [usersResponse, orgsResponse] = await Promise.all([
          apiClient.getUsers(),
          apiClient.getOrganizations()
        ]);

        setUsers(usersResponse.users);
        setOrgs(orgsResponse.organizations);
      } catch (error) {
        console.error('Failed to fetch users and organizations:', error);
        // Keep empty arrays if fetch fails
      }
    };

    fetchUsersAndOrgs();
  }, []);

  // --- Derived Master Data for Filters ---
  // Instead of static CATEGORIES constant, we derive from Classification Master
  const derivedFilters = useMemo(() => {
      const uniqueCats = Array.from(new Set(classificationData.map(c => c.categoryName).filter(Boolean))).sort();
      const uniqueClasses = Array.from(new Set(classificationData.map(c => c.classId).filter(Boolean))).sort();
      const uniqueDors = dorData.map(d => d.code).sort();
      const uniqueSources = sourceData.map(s => s.name).sort();
      const uniqueAreas = Array.from(new Set(allPfaRef.current.map(p => p.areaSilo).filter(Boolean))).sort(); // Areas usually come from Org structure or PFA data itself
      const uniqueManufacturers = manufacturerData.map(m => m.name).sort();
      const uniqueModels = modelData.map(m => m.name).sort();

      return { 
          availableCategories: uniqueCats, 
          availableClasses: uniqueClasses,
          availableDors: uniqueDors,
          availableSources: uniqueSources,
          availableAreas: uniqueAreas,
          availableManufacturers: uniqueManufacturers,
          availableModels: uniqueModels
      };
  }, [classificationData, dorData, sourceData, manufacturerData, modelData, dataVersion]); // dataVersion dependency to catch new PFA areas

  // Determine Current Active Filters based on Selected Org
  const currentOrgId = currentUser?.organizationId || '';
  
  // Get active filters or fallback to default if new org encountered
  const filters = useMemo(() => {
      if (!orgSpecificFilters[currentOrgId] && derivedFilters.availableCategories.length > 0) {
          return createDefaultFilters(
              derivedFilters.availableCategories, 
              derivedFilters.availableClasses,
              derivedFilters.availableDors,
              derivedFilters.availableSources,
              derivedFilters.availableAreas
          );
      }
      return orgSpecificFilters[currentOrgId] || createDefaultFilters([], [], [], [], []);
  }, [orgSpecificFilters, currentOrgId, derivedFilters]);

  // Handler to update filters for the specific organization
  const handleSetFilters = useCallback((newFilters: FilterState | ((prev: FilterState) => FilterState)) => {
      if (!currentOrgId) return;
      
      setOrgSpecificFilters(prev => {
          const current = prev[currentOrgId] || createDefaultFilters([], [], [], [], []);
          const updated = typeof newFilters === 'function' ? newFilters(current) : newFilters;
          return {
              ...prev,
              [currentOrgId]: updated
          };
      });
  }, [currentOrgId]);

  // --- Theme Application Effect ---
  useEffect(() => {
      const theme = currentUser?.themePreference === 'system' 
          ? systemConfig.defaultTheme 
          : (currentUser?.themePreference || systemConfig.defaultTheme);
      
      const root = document.documentElement;
      if (theme === 'dark') root.classList.add('dark');
      else root.classList.remove('dark');
  }, [currentUser, systemConfig.defaultTheme]);

  // --- Filtering Effect ---
  useEffect(() => {
      const source = allPfaRef.current;
      const baseline = baselinePfaRef.current;
      if (!source.length) return;

      const isVisible = (a: PfaRecord) => {
          // Organization Isolation Context
          if (currentUser?.organizationId && a.organization !== currentUser.organizationId) {
              return false;
          }

          if (selectedIds.has(a.id)) return true;
          if (focusMode && !selectedIds.has(a.id)) return false;

          // Safe cast for filtering
          const searchStr = String(filters.search || '').toLowerCase();
          if (searchStr && !String(a.pfaId || '').toLowerCase().includes(searchStr)) return false;

          const fStart = new Date(a.forecastStart); fStart.setHours(0,0,0,0);
          const fEnd = new Date(a.forecastEnd); fEnd.setHours(0,0,0,0);
          
          if (filters.startDateFrom && fStart < new Date(filters.startDateFrom)) return false;
          if (filters.startDateTo && fStart > new Date(filters.startDateTo)) return false;
          if (filters.endDateFrom && fEnd < new Date(filters.endDateFrom)) return false;
          if (filters.endDateTo && fEnd > new Date(filters.endDateTo)) return false;

          if (filters.status.length > 0) {
              const isAct = a.isActualized && filters.status.includes('Actuals');
              const isFcst = !a.isActualized && !a.isDiscontinued && filters.status.includes('Forecast');
              const isDisc = a.isDiscontinued && filters.status.includes('Discontinued');
              const isFt = a.isFundsTransferable && filters.status.includes('Funds Transferable');
              if (!isAct && !isFcst && !isDisc && !isFt) return false;
          }
          
          if (filters.category.length && !filters.category.includes(a.category)) return false;
          if (filters.classType.length && !filters.classType.includes(a.class)) return false;
          if (filters.dor.length && !filters.dor.includes(a.dor)) return false;
          if (filters.areaSilo.length && !filters.areaSilo.includes(a.areaSilo)) return false;
          if (filters.source.length && !filters.source.includes(a.source)) return false;

          return true;
      };

      const filteredSource = source.filter(isVisible);
      const filteredBaseline = baseline.filter(isVisible);

      setVisiblePfaRecords(filteredSource.slice(0, 800));
      setVisibleBaselinePfaRecords(filteredBaseline.slice(0, 800));

  }, [dataVersion, filters, focusMode, selectedIds, currentUser?.organizationId]);

  const activeOrg = orgs.find(o => o.id === currentUser?.organizationId) || MOCK_ORGS[0];

  // Determine which organizations the user can access for the sidebar
  const userAllowedOrgs = useMemo(() => {
      if (!currentUser) return [];
      return orgs.filter(o => currentUser.allowedOrganizationIds.includes(o.id));
  }, [currentUser, orgs]);

  const livePfaRecords = useMemo(() => {
      if (!dragOverrides || dragOverrides.size === 0) return visiblePfaRecords;
      return visiblePfaRecords.map(a => {
          const override = dragOverrides.get(a.id);
          if (override) {
              return override.layer === 'actual' 
                  ? { ...a, actualStart: override.start, actualEnd: override.end, hasActuals: true }
                  : { ...a, forecastStart: override.start, forecastEnd: override.end };
          }
          return a;
      });
  }, [visiblePfaRecords, dragOverrides]);

  const bounds = useMemo(() => {
      if (!visiblePfaRecords.length) return getTimelineBounds(new Date().toISOString(), new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString());
      let min = new Date(8640000000000000);
      let max = new Date(-8640000000000000);
      visiblePfaRecords.forEach(a => {
          if(a.forecastStart < min) min = a.forecastStart;
          if(a.forecastEnd > max) max = a.forecastEnd;
      });
      const start = new Date(min); start.setMonth(start.getMonth()-1);
      const end = new Date(max); end.setMonth(end.getMonth()+1);
      return { start, end, totalDays: getDaysDiff(start, end) };
  }, [visiblePfaRecords]);

  // --- Navigation Context Switching ---
  const handleSwitchContext = (orgId: string, mode: AppMode) => {
      if (!currentUser) return;
      
      // Update the current user state to reflect the new active organization
      const updatedUser = { ...currentUser, organizationId: orgId };
      setCurrentUser(updatedUser);
      
      // Update the user in the main users list as well
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      
      setAppMode(mode);
  };

  const handleDataImport = async (file: File, type: string) => {
      setIsSubmitting(true);
      setLoadingMessage("Parsing Import File...");
      setTimeout(async () => {
          try {
              const text = await file.text();
              const rows = parseCSV(text);
              if (rows.length < 1) throw new Error("Empty file");
              const headers = rows[0].map(h => h.trim().replace(/^"|"$/g, ''));
              const dataRows = rows.slice(1);
              setLoadingMessage(`Processing ${dataRows.length} records...`);
              const mapping = exportConfig.fields[type as DataCategory];
              if (!mapping) {
                  alert(`No field mapping configured for import type: ${type}`);
                  setIsSubmitting(false);
                  setLoadingMessage(null);
                  return;
              }
              const parsedObjects = dataRows.map(row => {
                  const obj: any = {};
                  headers.forEach((header, index) => {
                      const cleanHeader = normalizeHeader(header);
                      const fieldDef = mapping.find(f => {
                          if (!f.enabled) return false;
                          const apiMapMatch = f.apiMap ? normalizeHeader(f.apiMap) === cleanHeader : false;
                          const labelMatch = normalizeHeader(f.label) === cleanHeader;
                          const internalMatch = f.internalKey ? normalizeHeader(f.internalKey) === cleanHeader : false;
                          return apiMapMatch || labelMatch || internalMatch;
                      });
                      if (fieldDef && fieldDef.internalKey) {
                          let value: any = row[index]?.trim();
                          value = value?.replace(/^"|"$/g, '');
                          if (typeof value === 'string') value = value.replace(/[$,]/g, ''); 
                          if (value?.toLowerCase() === 'true' || value === '1' || value?.toLowerCase() === 'yes') value = true;
                          else if (value?.toLowerCase() === 'false' || value === '0' || value?.toLowerCase() === 'no') value = false;
                          else if (!isNaN(Number(value)) && value !== '' && !value.includes('-') && !value.includes('/') && !value.includes(',')) value = Number(value);
                          if (typeof value === 'string') {
                              const dateMatch = Date.parse(value);
                              if (!isNaN(dateMatch) && value.length > 5 && (value.includes('-') || value.includes('/') || value.includes(','))) { value = new Date(value); }
                          }
                          obj[fieldDef.internalKey] = value;
                      }
                  });
                  return obj;
              });
              const validObjects = parsedObjects.filter(o => Object.keys(o).length > 0);
              
              switch (type) {
                  case 'pfa_import':
                      updatePfaRecords(prev => {
                          const newAssets = [...prev];
                          let updatedCount = 0;
                          let newCount = 0;
                          validObjects.forEach(obj => {
                              if (!obj.pfaId) return;
                              if (obj.originalStart && !obj.forecastStart) obj.forecastStart = new Date(obj.originalStart);
                              if (obj.originalEnd && !obj.forecastEnd) obj.forecastEnd = new Date(obj.originalEnd);
                              const idx = newAssets.findIndex(a => String(a.pfaId) === String(obj.pfaId));
                              if (idx >= 0) {
                                  newAssets[idx] = { ...newAssets[idx], ...obj };
                                  updatedCount++;
                              } else {
                                  const now = new Date();
                                  const newAsset: any = {
                                      id: `imp-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
                                      organization: 'Imported Org',
                                      areaSilo: 'Unassigned',
                                      category: 'Unassigned',
                                      class: 'Unassigned',
                                      source: 'Rental',
                                      dor: 'BEO',
                                      monthlyRate: 0,
                                      purchasePrice: 0,
                                      isActualized: false,
                                      isDiscontinued: false,
                                      isFundsTransferable: false,
                                      originalStart: now,
                                      originalEnd: new Date(now.getFullYear(), now.getMonth() + 6, 1),
                                      forecastStart: now,
                                      forecastEnd: new Date(now.getFullYear(), now.getMonth() + 6, 1),
                                      actualStart: now,
                                      actualEnd: now,
                                      ...obj
                                  };
                                  if (obj.originalStart && !obj.forecastStart) newAsset.forecastStart = obj.originalStart;
                                  if (obj.originalEnd && !obj.forecastEnd) newAsset.forecastEnd = obj.originalEnd;
                                  newAssets.push(newAsset);
                                  newCount++;
                              }
                          });
                          setLoadingMessage(`Updated ${updatedCount}, Created ${newCount} records.`);
                          return newAssets;
                      });
                      break;
                  case 'assets_import':
                      setAssetMasterData(prev => {
                          const newData = [...prev];
                          validObjects.forEach(obj => {
                              if (!obj.assetTag) return;
                              const idx = newData.findIndex(a => String(a.assetTag) === String(obj.assetTag));
                              if (idx >= 0) newData[idx] = { ...newData[idx], ...obj };
                              else newData.push({ id: `am-${Date.now()}-${Math.random()}`, ...obj } as any);
                          });
                          return newData;
                      });
                      break;
                  case 'class_cat_import':
                      setClassificationData(prev => {
                          const newData = [...prev];
                          validObjects.forEach(obj => {
                              const idx = newData.findIndex(a => a.classId === obj.classId);
                              if (idx >= 0 && obj.classId) newData[idx] = { ...newData[idx], ...obj };
                              else if (obj.classId) newData.push({ id: `cc-${Date.now()}-${Math.random()}`, ...obj } as any);
                          });
                          return newData;
                      });
                      break;
                  case 'users_import':
                      setUsers(prev => {
                          const newData = [...prev];
                          validObjects.forEach(obj => {
                              const idx = newData.findIndex(a => a.username === obj.username);
                              if (idx >= 0 && obj.username) newData[idx] = { ...newData[idx], ...obj };
                              else if (obj.username) newData.push({ id: `usr-${Date.now()}-${Math.random()}`, themePreference: 'system', role: 'user', allowedOrganizationIds: [], organizationId: '', ...obj } as any);
                          });
                          return newData;
                      });
                      break;
                  case 'orgs_import':
                      setOrgs(prev => {
                          const newData = [...prev];
                          validObjects.forEach(obj => {
                              const idx = newData.findIndex(a => a.id === obj.id);
                              if (idx >= 0 && obj.id) newData[idx] = { ...newData[idx], ...obj };
                              else if (obj.id) newData.push({ ...obj, permissions: { viewTimeline: true, viewMatrix: true, viewGrid: true, canExport: true }, features: { ai: false }, aiRules: [] } as any);
                          });
                          return newData;
                      });
                      break;
                  case 'user_orgs_import':
                      setUsers(prev => {
                          const newData = [...prev];
                          validObjects.forEach(obj => {
                              const userIdx = newData.findIndex(u => u.username === obj.username);
                              if (userIdx >= 0 && obj.organizationId) {
                                  const user = newData[userIdx];
                                  const currentOrgs = user.allowedOrganizationIds || [];
                                  if (!currentOrgs.includes(obj.organizationId)) {
                                      user.allowedOrganizationIds = [...currentOrgs, obj.organizationId];
                                      if (!user.organizationId) user.organizationId = obj.organizationId;
                                  }
                              }
                          });
                          return newData;
                      });
                      break;
              }
              setTimeout(() => {
                  setIsSubmitting(false);
                  setLoadingMessage(null);
                  alert(`Successfully processed ${validObjects.length} rows.`);
              }, 500);
          } catch (e) {
              console.error("Import Failed", e);
              setIsSubmitting(false);
              setLoadingMessage(null);
              alert("Failed to import file. Please check format (CSV required).");
          }
      }, 100);
  };

  const pushHistory = () => { historyRef.current = [...historyRef.current, cloneAssets(allPfaRef.current)]; if (historyRef.current.length > 20) historyRef.current.shift(); futureRef.current = []; setCanUndo(true); setCanRedo(false); setHasUnsavedChanges(true); };
  const updatePfaRecords = (fn: (assets: PfaRecord[]) => PfaRecord[]) => { pushHistory(); allPfaRef.current = fn(allPfaRef.current); setDataVersion(v => v + 1); };
  const handleBulkUpdate = (updates: Partial<PfaRecord>[]) => { updatePfaRecords(prev => { const updateMap = new Map(updates.map(u => [u.id!, u])); return prev.map(asset => { const update = updateMap.get(asset.id); return update ? { ...asset, ...update } : asset; }); }); };
  const handleUpdateAsset = (id: string, start: Date, end: Date, layer: 'forecast'|'actual') => { updatePfaRecords(prev => prev.map(a => a.id === id ? (layer === 'actual' ? {...a, actualStart: start, actualEnd: end, hasActuals: true} : {...a, forecastStart: start, forecastEnd: end}) : a)); };
  const handleUpdateAssets = (updates: {id: string, start: Date, end: Date, layer: 'forecast'|'actual'}[]) => { updatePfaRecords(prev => { const map = new Map(updates.map(u => [u.id, u])); return prev.map(a => { const u = map.get(a.id); return u ? (u.layer === 'actual' ? {...a, actualStart: u.start, actualEnd: u.end, hasActuals: true} : {...a, forecastStart: u.start, forecastEnd: u.end}) : a; }); }); };
  const handleUndo = () => { if (!historyRef.current.length) return; futureRef.current = [allPfaRef.current, ...futureRef.current]; allPfaRef.current = historyRef.current.pop()!; setCanUndo(historyRef.current.length > 0); setCanRedo(true); setDataVersion(v => v + 1); };
  const handleRedo = () => { if (!futureRef.current.length) return; historyRef.current = [...historyRef.current, allPfaRef.current]; allPfaRef.current = futureRef.current.shift()!; setCanUndo(true); setCanRedo(futureRef.current.length > 0); setDataVersion(v => v + 1); };
  const handleDiscardChanges = () => { if (window.confirm("Are you sure you want to discard all changes and revert to the baseline?")) { const restoredData = cloneAssets(baselinePfaRef.current); allPfaRef.current = restoredData; historyRef.current = []; futureRef.current = []; setHasUnsavedChanges(false); setCanUndo(false); setCanRedo(false); setSelectedIds(new Set()); setDragOverrides(null); setDataVersion(v => v + 1); setRemountKey(k => k + 1); } };
  const handleSubmitChanges = async () => { setIsSubmitting(true); setLoadingMessage("Saving changes..."); await new Promise(resolve => setTimeout(resolve, 1200)); baselinePfaRef.current = cloneAssets(allPfaRef.current); setHasUnsavedChanges(false); setDataVersion(v=>v+1); historyRef.current = []; futureRef.current = []; setCanUndo(false); setCanRedo(false); setIsSubmitting(false); setLoadingMessage(null); };
  // Logout handler
  const handleLogout = () => {
    authLogout();
    setShowProfile(false);
    setShowSettings(false);
    setAiMode('hidden');
  };

  const MenuItem = ({ label, icon: Icon, active, onClick }: { label: string, icon: any, active: boolean, onClick: () => void }) => (
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group whitespace-nowrap
            ${active 
                ? 'bg-slate-800 text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
            }
        `}
        title={!isNavOpen ? label : ''}
      >
        <Icon className={`w-4 h-4 flex-none ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
        <span className={`transition-opacity duration-200 ${isNavOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>{label}</span>
      </button>
  );

  const MenuHeader = ({ label }: { label: string }) => (
      <div className={`px-3 mt-4 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider transition-opacity duration-300 ${isNavOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
          {label}
      </div>
  );

  // Show loading screen while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return <LoginScreen config={systemConfig} />;
  }
  
  // Determine if current view is a Lab view (timeline/matrix/grid)
  const isLabView = ['timeline-lab', 'matrix-lab', 'grid-lab', 'pfa-1.0-lab'].includes(appMode);

  // Admin screens are now rendered in the main layout below

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
        
        {/* Main Navigation Sidebar */}
        <aside className={`${isNavOpen ? 'w-64' : 'w-16'} flex-none bg-slate-900 text-white flex flex-col border-r border-slate-800 transition-all duration-300 ease-in-out overflow-hidden relative z-50 shadow-xl`}>
            <div className="flex flex-col h-full">
                {/* Brand */}
                <div className={`h-16 flex items-center ${isNavOpen ? 'px-6 justify-between' : 'justify-center'} border-b border-slate-800 flex-none transition-all`}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-none shadow-lg shadow-blue-600/20">
                            <Activity className="w-5 h-5 text-white" />
                        </div>
                        <div className={`min-w-0 transition-opacity duration-300 ${isNavOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
                            <div className="font-black text-sm tracking-tight leading-none">PFA</div>
                            <div className="font-bold text-sm tracking-tight text-slate-400 leading-none">Vanguard</div>
                        </div>
                    </div>
                    {isNavOpen && (
                        <button onClick={() => setIsNavOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                            <PanelLeftClose className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {!isNavOpen && (
                    <div className="flex justify-center py-4 border-b border-slate-800">
                        <button 
                            onClick={() => setIsNavOpen(true)}
                            className="p-3 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-500 transition-colors"
                            title="Expand Navigation"
                        >
                            <PanelLeftOpen className="w-5 h-5" />
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
                    
                    {/* Per Organization Grouping */}
                    {userAllowedOrgs.map(org => (
                        <React.Fragment key={org.id}>
                            <MenuHeader label={org.name} />
                            <MenuItem 
                                label="Timeline Lab" 
                                icon={Activity} 
                                active={appMode === 'timeline-lab' && currentUser.organizationId === org.id} 
                                onClick={() => handleSwitchContext(org.id, 'timeline-lab')} 
                            />
                            <MenuItem 
                                label="Matrix Lab" 
                                icon={Table} 
                                active={appMode === 'matrix-lab' && currentUser.organizationId === org.id} 
                                onClick={() => handleSwitchContext(org.id, 'matrix-lab')} 
                            />
                            <MenuItem 
                                label="Grid Lab" 
                                icon={LayoutGrid} 
                                active={appMode === 'grid-lab' && currentUser.organizationId === org.id} 
                                onClick={() => handleSwitchContext(org.id, 'grid-lab')} 
                            />
                            <MenuItem 
                                label="PFA 1.0 Lab" 
                                icon={Blocks} 
                                active={appMode === 'pfa-1.0-lab' && currentUser.organizationId === org.id} 
                                onClick={() => handleSwitchContext(org.id, 'pfa-1.0-lab')} 
                            />
                        </React.Fragment>
                    ))}

                    {/* General Tools Section */}
                    <MenuHeader label="Tools" />
                    <MenuItem 
                        label="Export Data" 
                        icon={FileDown} 
                        active={appMode === 'export'} 
                        onClick={() => setAppMode('export')} 
                    />
                    
                    {currentUser.role === 'admin' && (
                        <>
                            <MenuHeader label="Administration" />
                            <MenuItem label="API Connectivity" icon={Plug} active={appMode === 'api-connectivity'} onClick={() => setAppMode('api-connectivity')} />
                            <MenuItem label="Data Import" icon={Database} active={appMode === 'data-import'} onClick={() => setAppMode('data-import')} />
                            <MenuItem label="Field Configuration" icon={FileDown} active={appMode === 'field-config'} onClick={() => setAppMode('field-config')} />
                            <MenuItem label="Organization" icon={Building2} active={appMode === 'organization'} onClick={() => setAppMode('organization')} />
                            <MenuItem label="System Settings" icon={Settings} active={appMode === 'system-settings'} onClick={() => setAppMode('system-settings')} />
                            <MenuItem label="User Management" icon={Users} active={appMode === 'user-management'} onClick={() => setAppMode('user-management')} />

                            <MenuHeader label="Master Data" />
                            <MenuItem label="Asset" icon={Monitor} active={appMode === 'asset-master'} onClick={() => setAppMode('asset-master')} />
                            <MenuItem label="Class & Category" icon={Tag} active={appMode === 'class-master'} onClick={() => setAppMode('class-master')} />
                            <MenuItem label="DOR" icon={Layers} active={appMode === 'dor-master'} onClick={() => setAppMode('dor-master')} />
                            <MenuItem label="Manufacturers" icon={Factory} active={appMode === 'manufacturer-master'} onClick={() => setAppMode('manufacturer-master')} />
                            <MenuItem label="Models" icon={Truck} active={appMode === 'model-master'} onClick={() => setAppMode('model-master')} />
                            <MenuItem label="PFA" icon={Table} active={appMode === 'pfa-master'} onClick={() => setAppMode('pfa-master')} />
                            <MenuItem label="Source" icon={Box} active={appMode === 'source-master'} onClick={() => setAppMode('source-master')} />

                            <MenuHeader label="Logs" />
                            <MenuItem label="AI Usage" icon={Brain} active={appMode === 'ai-usage-logs'} onClick={() => setAppMode('ai-usage-logs')} />
                            <MenuItem label="Data Sync" icon={Activity} active={appMode === 'sync-logs'} onClick={() => setAppMode('sync-logs')} />
                        </>
                    )}
                </div>

                <div className="p-3 border-t border-slate-800 bg-slate-900/50 flex-none">
                    <div className={`flex items-center gap-3 p-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer group ${isNavOpen ? '' : 'justify-center'}`} onClick={() => setShowProfile(true)}>
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden flex-none ring-2 ring-transparent group-hover:ring-blue-500 transition-all">
                            {currentUser.avatarUrl ? (
                                <img src={currentUser.avatarUrl} alt="User" className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-xs font-bold text-slate-400">{currentUser.username[0].toUpperCase()}</div>
                            )}
                        </div>
                        <div className={`flex-1 min-w-0 transition-opacity duration-300 ${isNavOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
                            <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
                            <div className="text-[10px] text-slate-400 truncate capitalize">{currentUser.role}</div>
                        </div>
                        {isNavOpen && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleLogout(); }}
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

        <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 relative h-full overflow-hidden">
            
            <Header
                onOpenSettings={() => setShowSettings(true)}
                onOpenProfile={() => setShowProfile(true)}
                appName="PFA Vanguard"
                org={activeOrg}
                user={currentUser}
                showBranding={false}
                showUserProfile={false}
                hideSettings={['pfa-master', 'asset-master', 'class-master', 'dor-master', 'source-master', 'manufacturer-master', 'model-master', 'ai-usage-logs', 'sync-logs'].includes(appMode)}
            />

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
                                onClose={() => setIsFilterOpen(false)}
                            />
                        </aside>
                        
                        {/* Floating Open Toggle - Fixed Z-Index and Positioning */}
                        {!isFilterOpen && (
                            <div className="absolute left-0 top-4 z-50">
                                <button 
                                    onClick={() => setIsFilterOpen(true)} 
                                    className="p-3 bg-blue-600 rounded-r-xl shadow-lg text-white hover:bg-blue-500 transition-transform hover:scale-105 flex items-center justify-center"
                                >
                                    <PanelLeftOpen className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </>
                )}

                <div className={isLabView ? "flex-1 h-full p-2 pl-0 overflow-hidden relative flex flex-col" : "flex-1 h-full p-6 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950"} key={remountKey}>
                    {appMode === 'timeline-lab' && (
                        <TimelineLab 
                            pfaRecords={visiblePfaRecords} 
                            onUpdateAsset={handleUpdateAsset} onUpdateAssets={handleUpdateAssets}
                            onUpdateAssetRate={(id, r) => updatePfaRecords(prev => prev.map(a => a.id === id ? (a.source === 'Purchase' ? {...a, purchasePrice: r} : {...a, monthlyRate: r}) : a))}
                            onUpdateAssetStatus={(id, s) => updatePfaRecords(prev => prev.map(a => a.id === id ? {...a, isActualized: s} : a))}
                            onUpdateAssetEquipment={(id, e) => updatePfaRecords(prev => prev.map(a => a.id === id ? {...a, equipment: e} : a))}
                            onDragChange={setDragOverrides}
                            viewMode="timeline" scale={scale} setScale={setScale} zoomLevel={zoomLevel} barDisplayMode={barDisplayMode} visibleSeries={visibleSeries}
                            selectedIds={selectedIds} onToggleSelection={(id) => setSelectedIds(prev => { const n = new Set(prev); if(n.has(id)) n.delete(id); else n.add(id); return n; })}
                            onSelectMultiple={(ids, sel) => setSelectedIds(prev => { const n = new Set(prev); ids.forEach(i => sel ? n.add(i) : n.delete(i)); return n; })}
                            gridColumns={gridColumns} colors={colors} bounds={bounds} 
                            onInitiateAddForecast={(vals) => { setNewForecastInitialValues(vals); setShowNewForecastModal(true); }}
                            assetMaster={assetMasterData} classificationData={classificationData}
                        />
                    )}
                    {appMode === 'matrix-lab' && (
                        <TimelineLab 
                            pfaRecords={visiblePfaRecords} 
                            onUpdateAsset={handleUpdateAsset} onUpdateAssets={handleUpdateAssets}
                            onUpdateAssetRate={(id, r) => updatePfaRecords(prev => prev.map(a => a.id === id ? (a.source === 'Purchase' ? {...a, purchasePrice: r} : {...a, monthlyRate: r}) : a))}
                            onUpdateAssetStatus={(id, s) => updatePfaRecords(prev => prev.map(a => a.id === id ? {...a, isActualized: s} : a))}
                            onUpdateAssetEquipment={(id, e) => updatePfaRecords(prev => prev.map(a => a.id === id ? {...a, equipment: e} : a))}
                            onDragChange={setDragOverrides}
                            viewMode="matrix" scale={scale} setScale={setScale} zoomLevel={zoomLevel} barDisplayMode={barDisplayMode} visibleSeries={visibleSeries}
                            selectedIds={selectedIds} onToggleSelection={(id) => setSelectedIds(prev => { const n = new Set(prev); if(n.has(id)) n.delete(id); else n.add(id); return n; })}
                            onSelectMultiple={(ids, sel) => setSelectedIds(prev => { const n = new Set(prev); ids.forEach(i => sel ? n.add(i) : n.delete(i)); return n; })}
                            gridColumns={gridColumns} colors={colors} bounds={bounds} 
                            onInitiateAddForecast={(vals) => { setNewForecastInitialValues(vals); setShowNewForecastModal(true); }}
                            assetMaster={assetMasterData} classificationData={classificationData}
                        />
                    )}
                    {/* PFA 1.0 Lab - Forces Quantity Matrix View */}
                    {appMode === 'pfa-1.0-lab' && (
                        <TimelineLab 
                            pfaRecords={visiblePfaRecords} 
                            onUpdateAsset={handleUpdateAsset} onUpdateAssets={handleUpdateAssets}
                            onUpdateAssetRate={(id, r) => updatePfaRecords(prev => prev.map(a => a.id === id ? (a.source === 'Purchase' ? {...a, purchasePrice: r} : {...a, monthlyRate: r}) : a))}
                            onUpdateAssetStatus={(id, s) => updatePfaRecords(prev => prev.map(a => a.id === id ? {...a, isActualized: s} : a))}
                            onUpdateAssetEquipment={(id, e) => updatePfaRecords(prev => prev.map(a => a.id === id ? {...a, equipment: e} : a))}
                            onDragChange={setDragOverrides}
                            viewMode="matrix" 
                            scale={scale} setScale={setScale} 
                            zoomLevel={zoomLevel} 
                            barDisplayMode="quantity" // FORCED QUANTITY MODE
                            visibleSeries={visibleSeries}
                            selectedIds={selectedIds} onToggleSelection={(id) => setSelectedIds(prev => { const n = new Set(prev); if(n.has(id)) n.delete(id); else n.add(id); return n; })}
                            onSelectMultiple={(ids, sel) => setSelectedIds(prev => { const n = new Set(prev); ids.forEach(i => sel ? n.add(i) : n.delete(i)); return n; })}
                            gridColumns={gridColumns} colors={colors} bounds={bounds} 
                            onInitiateAddForecast={(vals) => { setNewForecastInitialValues(vals); setShowNewForecastModal(true); }}
                            assetMaster={assetMasterData} classificationData={classificationData}
                        />
                    )}
                    {appMode === 'grid-lab' && (
                        <GridLab 
                            assets={visiblePfaRecords} 
                            selectedIds={selectedIds} 
                            onToggleSelection={(id) => setSelectedIds(prev => { const n = new Set(prev); if(n.has(id)) n.delete(id); else n.add(id); return n; })}
                            onSelectMultiple={(ids, sel) => setSelectedIds(prev => { const n = new Set(prev); ids.forEach(i => sel ? n.add(i) : n.delete(i)); return n; })}
                        />
                    )}
                    {appMode === 'export' && (
                        <ExportView config={exportConfig} assets={allPfaRef.current} baselineAssets={baselinePfaRef.current} />
                    )}

                    {/* Admin Screens */}
                    {appMode === 'organization' && (
                        <OrgManager orgs={orgs} setOrgs={setOrgs} availableAiApis={apis.filter(api => api.usage === 'AI')} />
                    )}
                    {appMode === 'user-management' && (
                        <UserManager users={users} setUsers={setUsers} orgs={orgs} currentUser={currentUser} />
                    )}
                    {appMode === 'api-connectivity' && (
                        <ApiConnectivity />
                    )}
                    {appMode === 'data-import' && (
                        <DataImporter onImportExcel={handleDataImport} config={exportConfig} assets={allPfaRef.current} />
                    )}
                    {appMode === 'pfa-master' && (
                        <PfaMasterView assets={allPfaRef.current} />
                    )}
                    {appMode === 'asset-master' && (
                        <AssetMasterView data={assetMasterData} />
                    )}
                    {appMode === 'class-master' && (
                        <ClassificationView data={classificationData} />
                    )}
                    {appMode === 'dor-master' && (
                        <GenericMasterView
                            title="DOR"
                            description="Division of Responsibility codes."
                            data={dorData}
                            columns={[{key:'code', label:'Code', width:'120px'}, {key:'description', label:'Description'}]}
                            icon={Layers}
                        />
                    )}
                    {appMode === 'source-master' && (
                        <GenericMasterView
                            title="Source"
                            description="Funding sources (e.g., Rental vs Purchase)."
                            data={sourceData}
                            columns={[{key:'name', label:'Name', width:'200px'}, {key:'type', label:'Type', width:'100px'}]}
                            icon={Box}
                        />
                    )}
                    {appMode === 'manufacturer-master' && (
                        <GenericMasterView
                            title="Manufacturers"
                            description="Equipment manufacturers."
                            data={manufacturerData}
                            columns={[{key:'name', label:'Name'}]}
                            icon={Factory}
                        />
                    )}
                    {appMode === 'model-master' && (
                        <GenericMasterView
                            title="Models"
                            description="Equipment models linked to manufacturers."
                            data={modelData}
                            columns={[{key:'name', label:'Name'}, {key:'manufacturerName', label:'Manufacturer'}]}
                            icon={Truck}
                        />
                    )}
                    {appMode === 'field-config' && (
                        <FieldConfigManager config={exportConfig} setConfig={setExportConfig} />
                    )}
                    {appMode === 'system-settings' && (
                        <SystemManager config={systemConfig} setConfig={setSystemConfig} />
                    )}
                    {appMode === 'ai-usage-logs' && (
                        <AiUsageLogsView organizationId={activeOrg.id} />
                    )}
                    {appMode === 'sync-logs' && (
                        <SyncLogsView organizationId={activeOrg.id} />
                    )}
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
                    <div className="fixed bottom-8 right-6 z-50 flex flex-col gap-4 items-center">
                        {(hasUnsavedChanges || canUndo) && (
                            <div className="flex flex-col gap-3 animate-in slide-in-from-bottom-8 fade-in duration-300 pb-2 items-center">
                                <button 
                                    onClick={handleUndo} 
                                    disabled={!canUndo || isSubmitting} 
                                    className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center transition-all transform hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed" 
                                    title="Undo"
                                >
                                    <Undo2 className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={handleRedo} 
                                    disabled={!canRedo || isSubmitting} 
                                    className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center transition-all transform hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed" 
                                    title="Redo"
                                >
                                    <Redo2 className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={handleDiscardChanges} 
                                    disabled={isSubmitting}
                                    className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 shadow-xl border border-red-200 dark:border-red-800 hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center justify-center transition-all transform hover:scale-110 disabled:opacity-50" 
                                    title="Discard All Changes"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={handleSubmitChanges} 
                                    disabled={isSubmitting}
                                    className="w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/30 border border-emerald-400 flex items-center justify-center transition-all transform hover:scale-110 disabled:opacity-70" 
                                    title="Submit Changes"
                                >
                                    {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
                                </button>
                                <div className="w-8 h-1 bg-slate-200 dark:bg-slate-700 rounded-full my-1"></div>
                            </div>
                        )}
                        {aiMode !== 'voice' && (
                            <button
                                onClick={() => setAiMode('voice')}
                                className="w-12 h-12 bg-slate-800 dark:bg-slate-700 text-white rounded-full shadow-xl border border-slate-600 flex items-center justify-center hover:bg-slate-700 dark:hover:bg-slate-600 transition-all transform hover:scale-110"
                                title="Voice Command"
                            >
                                <Mic className="w-5 h-5" />
                            </button>
                        )}
                        <button 
                            onClick={() => setAiMode(aiMode === 'hidden' ? 'panel' : 'hidden')}
                            className={`w-12 h-12 rounded-full shadow-xl border flex items-center justify-center transition-all transform hover:scale-110 ${aiMode !== 'hidden' ? 'bg-white text-violet-600 border-violet-200 rotate-90' : 'bg-violet-600 text-white border-violet-500'}`}
                            title="AI Assistant"
                        >
                            {aiMode !== 'hidden' ? <X className="w-6 h-6" /> : <Brain className="w-6 h-6" />}
                        </button>
                        {aiMode === 'hidden' && (
                            <button 
                                onClick={() => setShowNewForecastModal(true)}
                                className="w-12 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-xl shadow-blue-600/30 border border-blue-500 flex items-center justify-center transition-all transform hover:scale-110 active:scale-95"
                                title="Add Forecast"
                            >
                                <Plus className="w-6 h-6" />
                            </button>
                        )}
                    </div>
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
                onSave={(u) => {
                    const updated = { ...currentUser, ...u } as User;
                    setCurrentUser(updated);
                    setUsers(prev => prev.map(usr => usr.id === updated.id ? updated : usr));
                }}
            />
        )}

        {/* Global Loading Overlay */}
        {isSubmitting && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center flex-col gap-4 animate-in fade-in duration-300">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Database className="w-6 h-6 text-blue-500 animate-pulse" />
                    </div>
                </div>
                <div className="text-white font-bold text-lg tracking-wide">{loadingMessage || "Processing..."}</div>
            </div>
        )}

    </div>
  );
};

export default App;
