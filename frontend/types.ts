
// ReactNode removed - not currently used

// =============================================================================
// MIRROR + DELTA ARCHITECTURE - New Type System
// =============================================================================

/**
 * PfaMirrorData - Immutable baseline from PEMS
 *
 * This is the source of truth cached from PEMS. Fields are read-only
 * and match the PEMS API response structure.
 */
export interface PfaMirrorData {
  // Identity
  id: string; // Database primary key (required for UI operations)
  pfaId: string;
  organization: string;

  // Classification
  areaSilo: string;
  category: string;
  forecastCategory?: string;
  class: string;

  // Source & Financial Type
  source: 'Purchase' | 'Rental';
  dor: 'BEO' | 'PROJECT';

  // Status Flags (from PEMS)
  isActualized: boolean;
  isDiscontinued: boolean;
  isFundsTransferable: boolean;

  // Financial Data (from PEMS)
  monthlyRate: number;
  purchasePrice: number;

  // Equipment Details
  manufacturer: string;
  model: string;
  contract?: string;
  equipment?: string;

  // Timeline - PLAN (Baseline - Locked)
  originalStart: Date;
  originalEnd: Date;
  hasPlan?: boolean;

  // Timeline - FORECAST (Editable)
  forecastStart: Date;
  forecastEnd: Date;

  // Timeline - ACTUALS (Historical)
  actualStart: Date;
  actualEnd: Date;
  hasActuals: boolean;

  // PEMS Metadata
  pemsVersion?: string;
  lastSyncedAt?: Date;
  syncBatchId?: string;
}

/**
 * PfaModificationDelta - User-specific changes (partial override)
 *
 * Only contains fields that differ from the mirror baseline.
 * Stored as JSONB for flexibility and future-proofing.
 *
 * Fields allowed for modification by users through the UI.
 * Plan dates (originalStart/End) are never editable.
 */
export interface PfaModificationDelta {
  // Editable forecast fields
  forecastStart?: Date;
  forecastEnd?: Date;
  forecastCategory?: string;

  // User-modifiable classification fields
  category?: string;
  source?: 'Rental' | 'Purchase';
  dor?: 'BEO' | 'PROJECT';

  // Financial modification (rental rate changes)
  monthlyRate?: number;

  // Equipment assignment
  equipment?: string;

  // Status flags
  isDiscontinued?: boolean;
  isFundsTransferable?: boolean;

  // Actualization fields (when marking as complete)
  actualEnd?: Date;

  // User annotations
  notes?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

/**
 * PfaModification - Database record for user modifications
 *
 * Represents a single user's changes to a mirror record.
 * Multiple users can have different modifications to the same mirror.
 */
export interface PfaModification {
  id: string;
  mirrorId: string;
  organizationId: string;
  userId: string;

  delta: PfaModificationDelta;

  // Workflow State
  syncState: 'draft' | 'committed' | 'syncing' | 'sync_error';
  sessionId?: string;

  // Version Control
  baseVersion: number;
  currentVersion: number;
  modifiedFields: string[];

  // Audit Trail
  changeReason?: string;
  committedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * PfaView - Merged read-only view (Mirror + Delta)
 *
 * This is what the UI displays. It is NEVER persisted to the database.
 * Computed at query time using PostgreSQL JSONB merge (mirror.data || delta).
 */
export interface PfaView extends PfaMirrorData {
  // All fields from PfaMirrorData, potentially overridden by delta

  // Additional metadata about the merge (optional for backward compatibility)
  _metadata?: {
    mirrorId: string;
    hasModifications: boolean;
    syncState: 'pristine' | 'draft' | 'committed' | 'syncing' | 'sync_error';
    modifiedBy?: string;
    modifiedAt?: Date;
    modificationId?: string;
  };
}

// =============================================================================
// LEGACY TYPES - DEPRECATED (Backward Compatibility)
// =============================================================================

/**
 * PfaRecord - DEPRECATED - Legacy flat structure
 *
 * @deprecated Use PfaView for read operations, PfaModificationDelta for edits
 *
 * This type is maintained for backward compatibility during migration.
 * Will be removed in v2.0.
 */
export interface PfaRecord {
  id: string;
  pfaId: string;
  organization: string; // Defaulted to PEMS Organization
  areaSilo: string; // PFS_A_CORPORATE
  category: string; // PFS_A_CATEGORY
  forecastCategory?: string; // PFS_F_CATEGORY
  class: string; // PFS_F_CLASS

  source: 'Purchase' | 'Rental'; // PFS_A_SOURCE
  dor: 'BEO' | 'PROJECT'; // PFS_A_DOR

  // Status Flags
  isActualized: boolean; // PFA_ACT
  isDiscontinued: boolean; // PFA_DIS
  isFundsTransferable: boolean; // PFS_FT

  // Financials
  monthlyRate: number; // PFS_A_RATE (Used if Rental)
  purchasePrice: number; // PFS_A_PRICE (Used if Purchase)

  manufacturer: string; // PFS_F_MANUFACT
  model: string; // PFS_F_MODEL

  // Original Plan (Baseline)
  originalStart: Date;
  originalEnd: Date;
  hasPlan?: boolean;

  // Forecast Plan (Editable)
  forecastStart: Date;
  forecastEnd: Date;

  // Actuals (Historical/Current)
  actualStart: Date;
  actualEnd: Date;
  hasActuals: boolean;
  contract?: string;
  equipment?: string; // Link to AssetMasterRecord via Asset Tag

  // Fiscal Year
  year?: number;

  // Sync State (Phase 3 - Mirror + Delta Architecture)
  syncState?: 'pristine' | 'modified' | 'pending_sync' | 'sync_error' | 'committed';
  lastSyncedAt?: Date;
  modifiedFields?: string[];
  modifiedBy?: string;
  modifiedAt?: Date;
}

// Alias for backward compatibility (updated for Mirror + Delta architecture)
export type Asset = PfaView;

// --- MASTER DATA TYPES ---

export interface AssetMasterRecord {
    id: string;
    organizationId: string;
    assetCode: string;              // "Asset" column - equipment number/tag
    class?: string;                 // Equipment class code (e.g., "04", "57")
    category?: string;              // Equipment category code (e.g., "04150", "57000")
    equipmentStatus?: string;       // "In Use", "Available", "Withdrawn", etc.
    alias?: string;                 // Alternate asset identifier
    description?: string;           // Equipment description
    department?: string;            // Department code (e.g., "11100E", "57257E")
    commissionDate?: Date;          // Date asset was commissioned
    outOfService: boolean;          // YES/NO from PEMS
    assignedTo?: string;            // Assignment reference
    owner?: string;                 // Owner identifier (e.g., "BEO")
    source?: string;                // "OWNED" or "THIRD PARTY"
    serialNumber?: string;          // Equipment serial number
    altBillingDescription?: string; // Alternate billing description
    onSiteDate?: Date;              // Date asset arrived on site
    yearBuilt?: number;             // Year the equipment was built
    xCoordinate?: number;           // GPS X coordinate
    yCoordinate?: number;           // GPS Y coordinate
    withdrawalDate?: Date;          // Date asset was withdrawn
    vendor?: string;                // Vendor name
    vendorAssetNumber?: string;     // Vendor's asset identifier
    purchaseOrder?: string;         // Purchase order number
    purchaseCostOrVendorRate?: number; // Purchase cost or vendor rate
    purchaseOrderLineNo?: string;   // Purchase order line number
    model?: string;                 // Equipment model
    manufacturer?: string;          // Equipment manufacturer
    licensePlateNumber?: string;    // Vehicle license plate (if applicable)
    lastInventoryDate?: Date;       // Last physical inventory date

    // Sync tracking
    syncBatchId?: string;           // Bronze batch this record came from
    lastSyncedAt?: Date;            // Last sync timestamp
    createdAt?: Date;
    updatedAt?: Date;

    // Computed/derived fields for UI display
    organization?: string;          // Organization code (for display)
    assetTag?: string;              // Alias for assetCode (backward compat)
}

export interface ClassificationRecord {
    id: string;
    classId: string;
    className: string;
    categoryId: string;
    categoryName: string;
    iconUrl?: string;
}

export interface DorRecord {
    id: string;
    code: string;
    description: string;
}

export interface SourceRecord {
    id: string;
    name: string;
    type: 'Capex' | 'Opex';
}

export interface ManufacturerRecord {
    id: string;
    name: string;
    website?: string;
}

export interface ModelRecord {
    id: string;
    name: string;
    manufacturerId?: string;
    manufacturerName?: string;
}

export interface AreaSiloRecord {
    organizationId: string;
    areaSilo: string;
    description: string;
    organizationCode?: string;
    organizationName?: string;
}

export type GroupingField = 'none' | 'category' | 'class' | 'source' | 'status' | 'dor' | 'areaSilo' | 'manufacturer' | 'model';

export type Scale = 'Day' | 'Week' | 'Month' | 'Year';

export type DisplayMetric = 'none' | 'cost' | 'duration' | 'both' | 'quantity';

export interface ColorConfig {
  plan: string;
  forecast: string;
  actual: string;
}

export interface FilterState {
  category: string[];
  classType: string[];
  source: string[];
  dor: string[];
  status: string[];
  areaSilo: string[];
  search: string;
  startDateFrom?: string;
  startDateTo?: string;
  endDateFrom?: string;
  endDateTo?: string;
}

export interface TimelineBounds {
  start: Date;
  end: Date;
  totalDays: number;
}

export interface DragState {
  isDragging: boolean;
  assetId: string | null;
  edge: 'start' | 'end' | 'move' | null;
  startX: number;
  originalDates: { start: Date; end: Date } | null;
  snapshot?: Map<string, { start: Date; end: Date }>;
  currentUpdates?: Map<string, { start: Date; end: Date; layer: 'forecast' | 'actual' }>;
}

export interface DragUpdate {
    start: Date;
    end: Date;
    layer: 'forecast' | 'actual';
}

export type ViewMode = 'timeline' | 'matrix';

export type AppMode =
  | 'timeline-lab'
  | 'matrix-lab'
  | 'grid-lab'
  | 'pfa-1.0-lab'
  | 'export'
  | 'organization'
  | 'user-management'
  | 'role-templates'
  | 'api-connectivity'
  | 'api-servers'
  | 'data-import'
  | 'mapping-studio'
  | 'pfa-master'
  | 'asset-master'
  | 'class-master'
  | 'dor-master'
  | 'source-master'
  | 'manufacturer-master'
  | 'model-master'
  | 'area-silo-master'
  | 'field-config'
  | 'system-settings'
  | 'ai-usage-logs'
  | 'sync-logs'
  | 'sync-health'
  | 'beo-glass'
  | 'audit-search'
  | 'role-drift'
  | 'notification-settings'
  | 'narrative-reader'
  | 'arbitrage-opportunities'
  | 'vendor-pricing'
  | 'scenario-builder'
  | 'voice-analyst'
  | 'notification-events'
  | 'approval-queue';

export interface SeriesVisibility {
  plan: boolean;
  forecast: boolean;
  actual: boolean;
}

// Grid Configuration
export type ColumnId = 'pfaId' | 'areaSilo' | 'class' | 'category' | 'source' | 'dor' | 'estimatedStart' | 'estimatedEnd' | 'ratePrice' | 'manufacturer' | 'model' | 'isActualized' | 'totalCost';

export interface GridColumn {
    id: ColumnId;
    label: string;
    visible: boolean;
    width: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface GroupNode {
    id: string;
    label: string;
    field: GroupingField;
    level: number;
    assets: PfaRecord[];
    children: GroupNode[];
    totals: {
        plan: number;
        forecast: number;
        actual: number;
        delta: number;
        count: number;
    };
    bounds: {
        plan: DateRange;
        forecast: DateRange;
        actual: DateRange | null;
    };
}

export interface SortConfig {
    key: ColumnId;
    direction: 'asc' | 'desc';
}

// --- ADMIN & AUTH TYPES ---

export type UserRole = 'admin' | 'user';

export interface OrgPermissions {
    viewTimeline: boolean;
    viewMatrix: boolean;
    viewGrid: boolean;
    canExport: boolean;
}

export interface OrgFeatures {
    ai: boolean;
    aiAccessLevel?: 'full-access' | 'read-only';
    aiIconGeneration?: boolean;
}

export interface OrgHeaderConfig {
    showLogo: boolean;
    showId: boolean;
    showName: boolean;
    showDescription: boolean;
}

export interface Organization {
  id: string;
  code: string; // Unique org identifier (e.g., 'RIO', 'PORTARTHUR')
  name: string;
  description?: string;
  status: 'active' | 'out_of_service';
  logoUrl?: string; // Branding
  aiRules: string[]; // List of natural language rules for AI behavior
  aiConnectionId?: string; // Link to a specific API Config for AI
  permissions: OrgPermissions; // Control what users in this org can see
  submitMode: 'api' | 'download'; // How changes are handled
  features: OrgFeatures;
  headerConfig: OrgHeaderConfig; // Display preferences
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  organizationId: string; // Represents the CURRENTLY ACTIVE organization context
  allowedOrganizationIds: string[]; // List of IDs the user has access to
  name: string;
  email?: string;
  jobTitle?: string;
  avatarUrl?: string;
  themePreference?: 'light' | 'dark' | 'high-contrast' | 'sepia' | 'system';
  mustChangePassword?: boolean; // Flag for forced password change
  password?: string; // Mock password storage
  isBeoUser?: boolean; // Flag for Business Enterprise Overhead users (access to BEO Glass Mode)
  permissions?: string[]; // Array of permission strings (e.g., ['perm_ManageSettings', 'perm_ViewFinancials'])
}

export type ApiUsage = 'PFA' | 'Assets' | 'Classes' | 'Categories' | 'AI' | 'Users' | 'Organizations' | 'User_Organizations';

export type FeedFrequency = 'manual' | 'realtime' | '15min' | 'hourly' | 'daily' | 'weekly';

export interface ApiFeedConfig {
    category: DataCategory;
    frequency: FeedFrequency;
    lastSync?: Date;
}

export interface ApiHeader {
    key: string;
    value: string;
}

export interface ApiConfig {
  id: string;
  name: string;
  url: string;
  usage: ApiUsage; 
  organizationId?: string; // Optional: Linked to specific Organization (Legacy, use Org.aiConnectionId now)
  
  // Advanced Auth
  authType: 'none' | 'basic' | 'bearer' | 'apiKey';
  authKey?: string; // Username or API Key Name (e.g. x-api-key)
  authValue?: string; // Password or API Key Value
  tenantId?: string; // For Multi-tenant systems (e.g. HxGN Tenant)
  customHeaders?: ApiHeader[];

  // Data Feeds (Mapping Categories to Frequencies)
  feeds: ApiFeedConfig[];

  // AI Specific Fields
  provider?: 'Google' | 'OpenAI' | 'Azure';
  model?: string;

  status: 'connected' | 'error' | 'untested';
  lastResponse?: string;
  lastChecked?: Date;
}

export interface SystemConfig {
    appName: string;
    defaultTheme: 'light' | 'dark' | 'high-contrast' | 'sepia';
    loginLogoUrl: string;
    ssoCertificate?: string;
    // Branding Config
    loginHeadline?: string;
    loginHeadlineAccent?: string;
    loginDescription?: string;
    // AI Global Config
    aiGlobalRules: string[];
    voiceURI?: string; // Preferred TTS Voice ID
}

// Union of all possible record types for mapping
export type InternalKey = keyof PfaRecord | keyof AssetMasterRecord | keyof ClassificationRecord | keyof User | keyof Organization;

export interface FieldDefinition {
    id: string; // Unique ID for the field config
    label: string; // User Friendly Label (e.g. "PEMS Organization")
    apiMap?: string; // The External Field Name (e.g. "PFS_A_ORG")
    internalKey?: InternalKey; // The internal property to map to
    enabled: boolean;
    isCustom?: boolean; // If true, user can delete this field
}

export type DataCategory = 
    | 'forecast_export' 
    | 'actuals_export' 
    | 'pfa_import' 
    | 'assets_import' 
    | 'class_cat_import' 
    | 'users_import' 
    | 'orgs_import' 
    | 'user_orgs_import';

export interface DataExchangeConfig {
    // Map each category to its field definitions
    fields: Record<DataCategory, FieldDefinition[]>;
}

// --- PHASE 3 API TYPES ---

export interface PfaFilters {
  category?: string;
  class?: string;
  dor?: 'BEO' | 'PROJECT';
  source?: 'Rental' | 'Purchase';
  forecastStartFrom?: string;
  forecastStartTo?: string;
  forecastEndFrom?: string;
  forecastEndTo?: string;
  isActualized?: boolean;
  isDiscontinued?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PfaPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PfaSyncState {
  pristineCount: number;
  modifiedCount: number;
  pendingSyncCount: number;
  committedCount?: number;
  errorCount?: number;
}

export interface PfaDataResponse {
  success: boolean;
  data: PfaRecord[];
  pagination: PfaPagination;
  syncState: PfaSyncState;
}

/**
 * PfaModificationRequest - API request payload for modifying PFA records
 * @deprecated Use PfaModificationDelta with the new Mirror + Delta architecture
 */
export interface PfaModificationRequest {
  pfaId: string;
  changes: Partial<PfaRecord>;
}

export interface SaveDraftRequest {
  sessionId: string;
  modifications: PfaModificationRequest[];
}

export interface SaveDraftResponse {
  success: boolean;
  saved: number;
  sessionId: string;
  message?: string;
}

export interface CommitDraftRequest {
  sessionId?: string;
  pfaIds?: string[];
}

export interface CommitDraftResponse {
  success: boolean;
  committed: number;
  message: string;
}

export interface DiscardDraftRequest {
  sessionId?: string;
  pfaIds?: string[];
}

export interface DiscardDraftResponse {
  success: boolean;
  discarded: number;
  message?: string;
}

export interface CategoryStats {
  count: number;
  totalCost: number;
  planCost: number;
  forecastCost: number;
  actualCost: number;
}

export interface SourceStats {
  count: number;
  totalCost: number;
}

export interface PfaStatsResponse {
  success: boolean;
  stats: {
    totalRecords: number;
    totalPlanCost: number;
    totalForecastCost: number;
    totalActualCost: number;
    variance: {
      planVsForecast: number;
      planVsActual: number;
    };
    byCategory: Record<string, CategoryStats>;
    bySource: Record<string, SourceStats>;
  };
}

// --- ADR-005 PERMISSION SYSTEM TYPES ---

export type PermissionKey =
  | 'perm_Read'
  | 'perm_EditForecast'
  | 'perm_EditActuals'
  | 'perm_Delete'
  | 'perm_Import'
  | 'perm_RefreshData'
  | 'perm_Export'
  | 'perm_ViewFinancials'
  | 'perm_SaveDraft'
  | 'perm_Sync'
  | 'perm_ManageUsers'
  | 'perm_ManageSettings'
  | 'perm_ConfigureAlerts'
  | 'perm_Impersonate'
  | 'perm_UseAiFeatures';

// AI Feature Keys - Granular control over AI capabilities
export type AiFeatureKey =
  | 'ai_ChatAssistant'
  | 'ai_VoiceMode'
  | 'ai_PermissionSuggestions'
  | 'ai_PermissionExplanations'
  | 'ai_RoleDriftDetection'
  | 'ai_NaturalLanguageQueries'
  | 'ai_AnomalyDetection'
  | 'ai_FinancialMonitoring'
  | 'ai_SemanticAuditSearch'
  | 'ai_FinancialMasking'
  | 'ai_VendorPricingWatchdog'
  | 'ai_BeoVoiceAnalyst'
  | 'ai_NarrativeVariance'
  | 'ai_AssetArbitrage'
  | 'ai_ScenarioSimulator'
  | 'ai_SmartNotifications';

// AI Features interface for type-safe feature flags
export interface AiFeatures {
  ai_ChatAssistant: boolean;
  ai_VoiceMode: boolean;
  ai_PermissionSuggestions: boolean;
  ai_PermissionExplanations: boolean;
  ai_RoleDriftDetection: boolean;
  ai_NaturalLanguageQueries: boolean;
  ai_AnomalyDetection: boolean;
  ai_FinancialMonitoring: boolean;
  ai_SemanticAuditSearch: boolean;
  ai_FinancialMasking: boolean;
  ai_VendorPricingWatchdog: boolean;
  ai_BeoVoiceAnalyst: boolean;
  ai_NarrativeVariance: boolean;
  ai_AssetArbitrage: boolean;
  ai_ScenarioSimulator: boolean;
  ai_SmartNotifications: boolean;
}

export interface Permissions {
  perm_Read: boolean;
  perm_EditForecast: boolean;
  perm_EditActuals: boolean;
  perm_Delete: boolean;
  perm_Import: boolean;
  perm_RefreshData: boolean;
  perm_Export: boolean;
  perm_ViewFinancials: boolean;
  perm_SaveDraft: boolean;
  perm_Sync: boolean;
  perm_ManageUsers: boolean;
  perm_ManageSettings: boolean;
  perm_ConfigureAlerts: boolean;
  perm_Impersonate: boolean;
  perm_UseAiFeatures: boolean;
  // Index signature for dynamic access
  [key: string]: boolean;
}

export interface RoleTemplate {
  id: string;
  name: string;
  description?: string;
  permissions: Permissions;
  capabilities: Record<string, boolean>;
  screenAccess?: ScreenPermissions;
  aiFeatures?: Partial<AiFeatures>;
  aiAccessLevel?: 'full-access' | 'read-only';
  aiRules?: string[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- SCREEN-LEVEL PERMISSION SYSTEM ---

export type ScreenKey =
  // Data Views
  | 'screen_TimelineLab'
  | 'screen_MatrixLab'
  | 'screen_GridLab'
  | 'screen_Pfa10Lab'
  | 'screen_Export'
  // Administration
  | 'screen_ApiConnectivity'
  | 'screen_ApiServers'
  | 'screen_DataImport'
  | 'screen_MappingStudio'
  | 'screen_FieldConfig'
  | 'screen_BeoGlass'
  | 'screen_Organizations'
  | 'screen_SystemSettings'
  | 'screen_Notifications'
  // User & Roles
  | 'screen_UserManagement'
  | 'screen_RoleTemplates'
  // Master Data
  | 'screen_MasterData'
  | 'screen_Categories'
  | 'screen_AreaSilos'
  | 'screen_Contracts'
  | 'screen_SystemDictionary'
  | 'screen_EquipmentClasses'
  | 'screen_Vendors'
  // Logs & Audit
  | 'screen_AuditSearch'
  | 'screen_RoleDrift'
  | 'screen_AiUsageLogs'
  | 'screen_SyncLogs'
  | 'screen_SyncHealth'
  // BEO Intelligence
  | 'screen_NarrativeReader'
  | 'screen_ArbitrageOpportunities'
  | 'screen_VendorPricing'
  | 'screen_ScenarioBuilder';

export interface ScreenPermissions {
  screen_TimelineLab?: boolean;
  screen_MatrixLab?: boolean;
  screen_GridLab?: boolean;
  screen_Pfa10Lab?: boolean;
  screen_Export?: boolean;
  screen_ApiConnectivity?: boolean;
  screen_ApiServers?: boolean;
  screen_DataImport?: boolean;
  screen_MappingStudio?: boolean;
  screen_FieldConfig?: boolean;
  screen_BeoGlass?: boolean;
  screen_Organizations?: boolean;
  screen_SystemSettings?: boolean;
  screen_Notifications?: boolean;
  screen_UserManagement?: boolean;
  screen_RoleTemplates?: boolean;
  screen_MasterData?: boolean;
  screen_Categories?: boolean;
  screen_AreaSilos?: boolean;
  screen_Contracts?: boolean;
  screen_SystemDictionary?: boolean;
  screen_EquipmentClasses?: boolean;
  screen_Vendors?: boolean;
  screen_AuditSearch?: boolean;
  screen_RoleDrift?: boolean;
  screen_AiUsageLogs?: boolean;
  screen_SyncLogs?: boolean;
  screen_SyncHealth?: boolean;
  screen_NarrativeReader?: boolean;
  screen_ArbitrageOpportunities?: boolean;
  screen_VendorPricing?: boolean;
  screen_ScenarioBuilder?: boolean;
}

export const SCREEN_CATEGORIES: Record<string, { label: string; screens: ScreenKey[] }> = {
  dataViews: {
    label: 'Data Views',
    screens: ['screen_TimelineLab', 'screen_MatrixLab', 'screen_GridLab', 'screen_Pfa10Lab', 'screen_Export'],
  },
  administration: {
    label: 'Administration',
    screens: [
      'screen_ApiConnectivity',
      'screen_ApiServers',
      'screen_DataImport',
      'screen_MappingStudio',
      'screen_FieldConfig',
      'screen_BeoGlass',
      'screen_Organizations',
      'screen_SystemSettings',
      'screen_Notifications',
    ],
  },
  userRoles: {
    label: 'User & Roles',
    screens: ['screen_UserManagement', 'screen_RoleTemplates'],
  },
  masterData: {
    label: 'Master Data',
    screens: ['screen_MasterData', 'screen_Categories', 'screen_AreaSilos', 'screen_Contracts', 'screen_SystemDictionary', 'screen_EquipmentClasses', 'screen_Vendors'],
  },
  logsAudit: {
    label: 'Logs & Audit',
    screens: ['screen_AuditSearch', 'screen_RoleDrift', 'screen_AiUsageLogs', 'screen_SyncLogs', 'screen_SyncHealth'],
  },
  beoIntelligence: {
    label: 'BEO Intelligence',
    screens: ['screen_NarrativeReader', 'screen_ArbitrageOpportunities', 'screen_VendorPricing', 'screen_ScenarioBuilder'],
  },
};

export const SCREEN_LABELS: Record<ScreenKey, string> = {
  screen_TimelineLab: 'Timeline Lab',
  screen_MatrixLab: 'Matrix Lab',
  screen_GridLab: 'Grid Lab',
  screen_Pfa10Lab: 'PFA 1.0 Lab',
  screen_Export: 'Export Data',
  screen_ApiConnectivity: 'API Connectivity',
  screen_ApiServers: 'API Servers',
  screen_DataImport: 'Data Import',
  screen_MappingStudio: 'Mapping Studio',
  screen_FieldConfig: 'Field Configuration',
  screen_BeoGlass: 'BEO Glass Mode',
  screen_Organizations: 'Organizations',
  screen_SystemSettings: 'System Settings',
  screen_Notifications: 'Notifications',
  screen_UserManagement: 'User Management',
  screen_RoleTemplates: 'Role Templates',
  screen_MasterData: 'Master Data',
  screen_Categories: 'Equipment Categories',
  screen_AreaSilos: 'Areas & Silos',
  screen_Contracts: 'Contracts',
  screen_SystemDictionary: 'System Dictionary',
  screen_EquipmentClasses: 'Equipment Classes',
  screen_Vendors: 'Vendors',
  screen_AuditSearch: 'Audit Search',
  screen_RoleDrift: 'Role Drift',
  screen_AiUsageLogs: 'AI Usage Logs',
  screen_SyncLogs: 'Sync Logs',
  screen_SyncHealth: 'Sync Health',
  screen_NarrativeReader: 'Narrative Reader',
  screen_ArbitrageOpportunities: 'Arbitrage Opportunities',
  screen_VendorPricing: 'Vendor Pricing',
  screen_ScenarioBuilder: 'Scenario Builder',
};

export interface PersonalAccessToken {
  id: string;
  name: string;
  scopes: PermissionKey[];
  userId: string;
  organizationId: string;
  token?: string;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  revoked: boolean;
}

export interface UserSession {
  id: string;
  userId: string;
  deviceInfo?: {
    browser?: string;
    os?: string;
    ip?: string;
    location?: string;
  };
  lastActiveAt: string;
  expiresAt: string;
  invalidatedAt?: string;
  createdAt: string;
  isCurrent?: boolean;
}

export interface WebhookConfig {
  id: string;
  organizationId: string;
  type: 'slack' | 'teams' | 'custom';
  webhookUrl: string;
  channelName?: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SystemDictionaryEntry {
  id: string;
  category: string;
  value: string;
  label: string;
  order: number;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TrashItem {
  id: string;
  entityType: 'User' | 'Organization' | 'PfaRecord' | 'ApiServer';
  entityId: string;
  entityName: string;
  deletedBy: string;
  deletedAt: string;
  dependencies?: {
    type: string;
    count: number;
  }[];
  data: Record<string, unknown>;
}

// =============================================================================
// API RESPONSE TYPES - Unified types for backend API responses
// =============================================================================

/**
 * ApiUser - Comprehensive user type for API responses
 * Merges fields from backend user endpoints
 */
export interface ApiUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  avatarUrl?: string;
  role: 'admin' | 'user' | 'viewer';
  isActive: boolean;
  authProvider: 'local' | 'pems';
  externalId?: string;
  serviceStatus: 'active' | 'suspended' | 'locked';
  suspendedAt?: string;
  lockedAt?: string;
  failedLoginCount?: number;
  organizations: ApiUserOrganization[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * ApiUserOrganization - Organization with permissions for API user responses
 */
export interface ApiUserOrganization {
  id: string;
  code: string;
  name: string;
  logoUrl?: string | null;
  role: string;
  permissions?: Permissions;
}

/**
 * ApiOrganization - Comprehensive organization type for API responses
 */
export interface ApiOrganization {
  id: string;
  code: string;
  name: string;
  description?: string;
  logoUrl?: string;
  isActive: boolean;
  isSuspended?: boolean;
  suspendedReason?: string;
  suspendedAt?: string;
  suspendedBy?: string;
  syncEnabled?: boolean;
  enableSync: boolean;
  settings?: Record<string, unknown>;
  features?: OrgFeatures;
  aiFeatures?: Partial<AiFeatures>;
  aiConnectionId?: string | null;
  aiRules?: string[];
  submitMode?: 'api' | 'download';
  headerConfig?: OrgHeaderConfig;
  serviceStatus: 'active' | 'suspended' | 'archived';
  isExternal: boolean;
  externalId?: string;
  userCount: number;
  users: Array<{
    id: string;
    username: string;
    email?: string;
    role: string;
  }>;
  firstSyncAt?: string;
  lastSyncAt?: string;
  totalSyncRecordCount?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * JWTPayload - JWT token payload structure from backend
 */
export interface JWTPayload {
  userId: string;
  username: string;
  email: string | null;
  authProvider: 'local' | 'pems';
  serviceStatus: 'active' | 'suspended' | 'locked';
  organizations: Array<{
    organizationId: string;
    organizationCode: string;
    role: string;
    permissions: Permissions;
  }>;
  iat?: number;
  exp?: number;
}

/**
 * LoginResponse - Response from /api/auth/login
 */
export interface LoginResponse {
  token: string;
  user: ApiUser;
}

// --- API Configuration Types ---

export interface ApiServerConfig {
  id: string;
  organizationId?: string;
  name: string;
  description?: string;
  baseUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
  isActive: boolean;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PemsCredentials {
  id: string;
  organizationId: string;
  apiEndpoint: string;
  username: string;
  hasPassword: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Sync Types ---

export interface SyncHistoryItem {
  id: string;
  organizationId: string;
  syncType: 'full' | 'incremental';
  status: 'success' | 'failed' | 'in_progress';
  recordsAdded: number;
  recordsUpdated: number;
  recordsDeleted: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

export interface SyncLog {
  id: string;
  organizationId: string;
  syncType: string;
  status: string;
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsDeleted: number;
  durationMs: number | null;
  errorMessage: string | null;
  triggeredBy: string | null;
  createdAt: string;
}

export interface SyncStats {
  totalSyncs: number;
  successfulSyncs: number;
  successRate: number;
  totalRecordsProcessed: number;
  totalRecordsInserted: number;
  totalRecordsUpdated: number;
  totalRecordsDeleted: number;
  averageDuration: number;
}

// --- AI Types ---

export interface AiUsageLog {
  id: string;
  userId: string;
  organizationId: string;
  provider: 'gemini' | 'openai' | 'anthropic';
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  createdAt: string;
}

export interface AiChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AiChatRequest {
  messages: AiChatMessage[];
  organizationId: string;
  userId?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiChatResponse {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: {
    usd: number;
  };
  model: string;
  provider: string;
  latencyMs: number;
}

export interface AiUsageStats {
  today: {
    requests: number;
    totalCost: number;
    totalTokens: number;
  };
  thisMonth: {
    requests: number;
    totalCost: number;
    totalTokens: number;
  };
  budgetStatus: {
    dailyLimit: number;
    monthlyLimit: number;
    dailyUsed: number;
    monthlyUsed: number;
    dailyPercentage: number;
    monthlyPercentage: number;
  };
}

// --- User Organization Types ---

export interface UserOrganizationSummary {
  id: string;
  code: string;
  name: string;
  description?: string;
  isExternal: boolean;
  externalId?: string;
  serviceStatus: string;
}

export interface UserOrganization {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  permissions: Permissions | Record<string, boolean>;
  accessExpiresAt?: string;
  assignmentSource?: 'local' | 'pems_sync';
  externalRoleId?: string;
  isCustom?: boolean;
  organization?: UserOrganizationSummary;
  roleTemplate?: Record<string, boolean>;
  enabledCapabilitiesCount?: number;
  createdAt: string;
  updatedAt: string;
}

// --- Audit Types ---

export interface AuditLog {
  id: string;
  userId: string;
  organizationId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  resource?: string | null;
  method?: string | null;
  metadata?: Record<string, unknown>;
  success?: boolean;
  errorMessage?: string | null;
  changes?: AuditChange[];
  ipAddress?: string;
  userAgent?: string;
  timestamp?: Date | string;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

export interface AuditChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface AuditReview {
  id: string;
  userId: string;
  organizationId: string;
  action: string;
  entityType: string;
  summary: string;
  risk: 'low' | 'medium' | 'high';
  createdAt: string;
}

export interface AuditStats {
  totalActions: number;
  actionsByType: Record<string, number>;
  actionsByUser: Record<string, number>;
  recentActivity: number;
}

export interface RevertLog {
  id: string;
  auditLogId: string;
  revertedBy: string;
  revertedAt: string;
  status: 'success' | 'failed';
  errorMessage?: string;
}

// --- Permission Explanation Types ---

export interface PermissionExplanation {
  permission: string;
  hasAccess: boolean;
  reason: string;
  grantedBy?: string;
  expiresAt?: string;
}

// --- API Role Template (backend response) ---

export interface ApiRoleTemplate {
  id: string;
  name: string;
  description?: string;
  permissions: Permissions;
  capabilities: Record<string, boolean>;
  aiFeatures?: Record<string, boolean>;
  isSystem: boolean;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- API Personal Access Token (backend response) ---

export interface ApiPersonalAccessToken {
  id: string;
  userId: string;
  organizationId?: string;
  name: string;
  tokenPrefix?: string;
  scopes: PermissionKey[];
  revoked: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}

// --- Webhook Types ---

export interface Webhook {
  id: string;
  organizationId: string;
  type: 'slack' | 'teams' | 'custom';
  webhookUrl: string;
  channelName?: string;
  events: string[];
  secret?: string;
  isActive: boolean;
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Dictionary Types ---

export interface DictionaryEntry {
  id: string;
  category: string;
  value: string;
  label: string;
  order: number;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// --- API Trash Item (backend response) ---

export interface ApiTrashItem {
  id: string;
  entityType: 'User' | 'Organization' | 'PfaRecord' | 'ApiServer';
  entityId: string;
  entityName: string;
  entityData?: Record<string, unknown>;
  data?: Record<string, unknown>;
  deletedBy: string;
  organizationId?: string;
  reason?: string;
  deletedAt: string;
  expiresAt?: string;
  dependencies?: {
    type: string;
    count: number;
  }[];
}

// --- Pagination Types ---

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PfaMetadata {
  totalCost: number;
  totalRecords: number;
  filters: Record<string, unknown>;
}

// --- API Response Wrappers ---

export interface SuccessResponse<T> {
  success: true;
  data?: T;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  message?: string;
  code?: string;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;