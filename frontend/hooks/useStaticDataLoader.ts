/**
 * useStaticDataLoader Hook
 * Phase 6: Large File Refactoring (Updated)
 *
 * Manages and loads static master data from backend API.
 * Falls back to mock data if API is unavailable.
 */

import { useState, useEffect, useCallback } from 'react';
import type { AssetMasterRecord, ClassificationRecord, DorRecord, SourceRecord, ManufacturerRecord, ModelRecord, AreaSiloRecord } from '../types';
import { STATIC_CLASSIFICATION, STATIC_DORS, STATIC_SOURCES, STATIC_MANUFACTURERS, STATIC_MODELS } from '../mockData';
import { apiClient } from '../services/apiClient';

interface UseStaticDataLoaderReturn {
  assetMasterData: AssetMasterRecord[];
  setAssetMasterData: React.Dispatch<React.SetStateAction<AssetMasterRecord[]>>;
  classificationData: ClassificationRecord[];
  setClassificationData: React.Dispatch<React.SetStateAction<ClassificationRecord[]>>;
  dorData: DorRecord[];
  setDorData: React.Dispatch<React.SetStateAction<DorRecord[]>>;
  sourceData: SourceRecord[];
  setSourceData: React.Dispatch<React.SetStateAction<SourceRecord[]>>;
  manufacturerData: ManufacturerRecord[];
  setManufacturerData: React.Dispatch<React.SetStateAction<ManufacturerRecord[]>>;
  modelData: ModelRecord[];
  setModelData: React.Dispatch<React.SetStateAction<ModelRecord[]>>;
  areaSiloData: AreaSiloRecord[];
  setAreaSiloData: React.Dispatch<React.SetStateAction<AreaSiloRecord[]>>;
  loadAssetMasterData: () => Promise<void>;
  loadMasterData: () => Promise<void>;
  isLoadingAssets: boolean;
  isLoadingMasterData: boolean;
  masterDataSource: 'api' | 'mock' | 'loading';
}

export function useStaticDataLoader(): UseStaticDataLoaderReturn {
  const [assetMasterData, setAssetMasterData] = useState<AssetMasterRecord[]>([]);
  const [classificationData, setClassificationData] = useState<ClassificationRecord[]>([]);
  const [dorData, setDorData] = useState<DorRecord[]>([]);
  const [sourceData, setSourceData] = useState<SourceRecord[]>([]);
  const [manufacturerData, setManufacturerData] = useState<ManufacturerRecord[]>([]);
  const [modelData, setModelData] = useState<ModelRecord[]>([]);
  const [areaSiloData, setAreaSiloData] = useState<AreaSiloRecord[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [isLoadingMasterData, setIsLoadingMasterData] = useState(false);
  const [masterDataSource, setMasterDataSource] = useState<'api' | 'mock' | 'loading'>('loading');

  // Load asset master data from backend API
  const loadAssetMasterData = useCallback(async () => {
    setIsLoadingAssets(true);
    try {
      // Fetch all assets (cross-org view) with high page size
      const response = await apiClient.getAllAssets({ pageSize: 1000 });
      if (response.success && response.data) {
        // Transform dates from strings to Date objects if needed
        const transformed = response.data.map(asset => ({
          ...asset,
          commissionDate: asset.commissionDate ? new Date(asset.commissionDate) : undefined,
          onSiteDate: asset.onSiteDate ? new Date(asset.onSiteDate) : undefined,
          withdrawalDate: asset.withdrawalDate ? new Date(asset.withdrawalDate) : undefined,
          lastInventoryDate: asset.lastInventoryDate ? new Date(asset.lastInventoryDate) : undefined,
          lastSyncedAt: asset.lastSyncedAt ? new Date(asset.lastSyncedAt) : undefined,
          createdAt: asset.createdAt ? new Date(asset.createdAt) : undefined,
          updatedAt: asset.updatedAt ? new Date(asset.updatedAt) : undefined,
        }));
        setAssetMasterData(transformed);
      }
    } catch (error) {
      console.warn('[useStaticDataLoader] Failed to fetch asset master from API, using empty array:', error);
      setAssetMasterData([]);
    } finally {
      setIsLoadingAssets(false);
    }
  }, []);

  // Load master data (classifications, DORs, sources, manufacturers, models) from API
  const loadMasterData = useCallback(async () => {
    setIsLoadingMasterData(true);
    setMasterDataSource('loading');

    try {
      const response = await apiClient.getAllMasterData();

      if (response.success && response.data) {
        const { manufacturers, models, dors, sources, classifications, areaSilos } = response.data;

        // Transform API response to match existing type interfaces
        // Cast to any to handle API response shape differences
        const classificationList = classifications as Array<Record<string, unknown>>;
        const transformedClassifications: ClassificationRecord[] = classificationList.map((c, index) => ({
          id: String(c.id || `class-${index}`),
          classId: String(c.classCode || c.classId || ''),
          className: String(c.classDescription || c.className || ''),
          categoryId: String(c.categoryCode || c.categoryId || ''),
          categoryName: String(c.categoryDescription || c.categoryName || ''),
        }));
        setClassificationData(transformedClassifications);

        // DORs -> DorRecord[]
        const transformedDors: DorRecord[] = dors.map((d, index) => ({
          id: d.id || `dor-${index}`,
          code: d.code,
          description: d.description || '',
        }));
        setDorData(transformedDors);

        // Sources -> SourceRecord[]
        const sourceList = sources as Array<Record<string, unknown>>;
        const transformedSources: SourceRecord[] = sourceList.map((s, index) => ({
          id: String(s.id || `source-${index}`),
          name: String(s.code || s.name || ''),
          type: (s.type === 'Capex' || s.type === 'Opex') ? s.type as 'Capex' | 'Opex' : 'Capex',
        }));
        setSourceData(transformedSources);

        // Manufacturers -> ManufacturerRecord[]
        const transformedManufacturers: ManufacturerRecord[] = manufacturers.map((m, index) => ({
          id: `mfr-${index}`,
          name: m.code || m.description || '',
        }));
        setManufacturerData(transformedManufacturers);

        // Models -> ModelRecord[]
        const transformedModels: ModelRecord[] = models.map((m, index) => ({
          id: `model-${index}`,
          name: m.model || '',
          manufacturerId: undefined,
          manufacturerName: m.manufacturer || '',
        }));
        setModelData(transformedModels);

        // Area Silos -> AreaSiloRecord[]
        const transformedAreaSilos: AreaSiloRecord[] = (areaSilos || []).map(a => ({
          organizationId: a.organizationId,
          areaSilo: a.areaSilo,
          description: a.description || '',
        }));
        setAreaSiloData(transformedAreaSilos);

        setMasterDataSource('api');
        console.log('[useStaticDataLoader] Master data loaded from API:', {
          classifications: transformedClassifications.length,
          dors: transformedDors.length,
          sources: transformedSources.length,
          manufacturers: transformedManufacturers.length,
          models: transformedModels.length,
          areaSilos: transformedAreaSilos.length,
        });
      } else {
        throw new Error('API returned unsuccessful response');
      }
    } catch (error) {
      console.warn('[useStaticDataLoader] Failed to fetch master data from API, falling back to mock data:', error);

      // Fallback to mock data
      setClassificationData(STATIC_CLASSIFICATION);
      setDorData(STATIC_DORS);
      setSourceData(STATIC_SOURCES);
      setManufacturerData(STATIC_MANUFACTURERS);
      setModelData(STATIC_MODELS);
      setAreaSiloData([]); // No mock data for area silos
      setMasterDataSource('mock');
    } finally {
      setIsLoadingMasterData(false);
    }
  }, []);

  // Load all data on mount
  useEffect(() => {
    // Load asset master from API
    loadAssetMasterData();

    // Load master reference data from API (with fallback to mock)
    loadMasterData();
  }, [loadAssetMasterData, loadMasterData]);

  return {
    assetMasterData,
    setAssetMasterData,
    classificationData,
    setClassificationData,
    dorData,
    setDorData,
    sourceData,
    setSourceData,
    manufacturerData,
    setManufacturerData,
    modelData,
    setModelData,
    areaSiloData,
    setAreaSiloData,
    loadAssetMasterData,
    loadMasterData,
    isLoadingAssets,
    isLoadingMasterData,
    masterDataSource,
  };
}
