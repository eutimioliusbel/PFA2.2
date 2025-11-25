
import { ReactNode } from 'react';

// Formerly 'Asset' - This represents a Financial Ledger Line Item (PFA)
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

  // Sync State (Phase 3 - Mirror + Delta Architecture)
  syncState?: 'pristine' | 'modified' | 'pending_sync' | 'sync_error' | 'committed';
  lastSyncedAt?: Date;
  modifiedFields?: string[];
  modifiedBy?: string;
  modifiedAt?: Date;
}

// Alias for backward compatibility
export type Asset = PfaRecord;

// --- MASTER DATA TYPES ---

export interface AssetMasterRecord {
    id: string;
    assetTag: string; 
    alias?: string;
    description: string;
    organization: string;
    equipmentStatus?: string;
    department?: string;
    class: string;
    category: string;
    commissionDate?: Date;
    assignedTo?: string;
    owner?: string;
    source?: string;
    serialNumber?: string;
    onSiteDate?: Date;
    manufacturer: string;
    model: string;
    year?: string;
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
  themePreference?: 'light' | 'dark' | 'system';
  mustChangePassword?: boolean; // Flag for forced password change
  password?: string; // Mock password storage
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
    defaultTheme: 'light' | 'dark';
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

export interface PfaModification {
  pfaId: string;
  changes: Partial<PfaRecord>;
}

export interface SaveDraftRequest {
  sessionId: string;
  modifications: PfaModification[];
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