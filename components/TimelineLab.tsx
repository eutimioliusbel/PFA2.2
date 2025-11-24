
import React, { useState, useCallback, useEffect } from 'react';
import { Timeline } from './Timeline';
import { MatrixView } from './MatrixView';
import { PfaRecord, ViewMode, SeriesVisibility, Scale, DisplayMetric, GridColumn, GroupingField, ColorConfig, SortConfig, ColumnId, AssetMasterRecord, ClassificationRecord } from '../types';

interface TimelineLabProps {
    pfaRecords: PfaRecord[]; // Filtered assets passed from parent
    onUpdateAsset: (id: string, newStart: Date, newEnd: Date, layer: 'forecast' | 'actual') => void;
    onUpdateAssets: (updates: {id: string, start: Date, end: Date, layer: 'forecast' | 'actual'}[]) => void;
    onUpdateAssetRate: (id: string, newRate: number) => void; 
    onUpdateAssetStatus: (id: string, isActualized: boolean) => void;
    onUpdateAssetEquipment: (id: string, equipment: string) => void;
    onDragChange: (updates: Map<string, { start: Date; end: Date; layer: 'forecast' | 'actual' }> | null) => void;
    
    // View State passed from parent
    viewMode: ViewMode;
    scale: Scale;
    setScale: (s: Scale) => void;
    zoomLevel: number;
    barDisplayMode: DisplayMetric;
    visibleSeries: SeriesVisibility;
    
    // Selection
    selectedIds: Set<string>;
    onToggleSelection: (id: string) => void;
    onSelectMultiple: (ids: string[], selected: boolean) => void;

    // Settings (View Specific)
    gridColumns: GridColumn[];
    colors: ColorConfig;
    
    // Bounds (Calculated by parent or internally, but usually parent if KPI depends on it)
    bounds: any;
    
    // Add Forecast (Matrix)
    onInitiateAddForecast: (details: any) => void;

    // Master Data
    assetMaster?: AssetMasterRecord[];
    classificationData?: ClassificationRecord[];
}

export const TimelineLab: React.FC<TimelineLabProps> = ({ 
    pfaRecords, 
    onUpdateAsset, 
    onUpdateAssets,
    onUpdateAssetRate,
    onUpdateAssetStatus,
    onUpdateAssetEquipment,
    onDragChange,
    viewMode,
    scale,
    setScale,
    zoomLevel,
    barDisplayMode,
    visibleSeries,
    selectedIds,
    onToggleSelection,
    onSelectMultiple,
    gridColumns,
    colors,
    bounds,
    onInitiateAddForecast,
    assetMaster = [],
    classificationData = []
}) => {
  // --- View Specific Local State ---
  const [grouping, setGrouping] = useState<GroupingField[]>(['category']); 
  const [isGridCollapsed, setIsGridCollapsed] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'pfaId', direction: 'asc' });

  const handleSort = (columnId: ColumnId) => {
      setSortConfig(current => ({
          key: columnId,
          direction: current.key === columnId && current.direction === 'asc' ? 'desc' : 'asc'
      }));
  };

  // Sort the assets based on sortConfig
  const sortedRecords = React.useMemo(() => {
      if (!pfaRecords) return [];
      const sorted = [...pfaRecords].sort((a, b) => {
          const { key, direction } = sortConfig;
          let valA: any = '';
          let valB: any = '';
          const dir = direction === 'asc' ? 1 : -1;

          switch (key) {
              case 'pfaId': valA = a.pfaId; valB = b.pfaId; break;
              case 'areaSilo': valA = a.areaSilo; valB = b.areaSilo; break;
              case 'class': valA = a.class; valB = b.class; break;
              case 'category': valA = a.category; valB = b.category; break;
              case 'source': valA = a.source; valB = b.source; break;
              case 'dor': valA = a.dor; valB = b.dor; break;
              case 'estimatedStart': valA = a.forecastStart.getTime(); valB = b.forecastStart.getTime(); break;
              case 'estimatedEnd': valA = a.forecastEnd.getTime(); valB = b.forecastEnd.getTime(); break;
              case 'ratePrice': 
                   valA = a.source === 'Rental' ? a.monthlyRate : a.purchasePrice;
                   valB = b.source === 'Rental' ? b.monthlyRate : b.purchasePrice;
                   break;
              case 'manufacturer': valA = a.manufacturer || ''; valB = b.manufacturer || ''; break;
              case 'model': valA = a.model || ''; valB = b.model || ''; break;
              case 'isActualized':
                   valA = a.equipment || (a.isActualized ? 'ZZZ' : 'AAA'); 
                   valB = b.equipment || (b.isActualized ? 'ZZZ' : 'AAA');
                   break;
              default: return 0;
          }

          if (valA < valB) return -1 * dir;
          if (valA > valB) return 1 * dir;
          return 0;
      });
      return sorted;
  }, [pfaRecords, sortConfig]);

  return (
      <>
         {viewMode === 'timeline' ? (
           <Timeline 
              pfaRecords={sortedRecords} 
              onUpdateAsset={onUpdateAsset}
              onUpdateAssets={onUpdateAssets}
              onUpdateAssetRate={onUpdateAssetRate}
              onUpdateAssetStatus={onUpdateAssetStatus}
              onUpdateAssetEquipment={onUpdateAssetEquipment}
              onDragChange={onDragChange}
              bounds={bounds}
              selectedIds={selectedIds}
              onToggleSelection={onToggleSelection}
              onSelectMultiple={onSelectMultiple}
              grouping={grouping}
              visibleSeries={visibleSeries}
              scale={scale}
              onScaleChange={setScale}
              barDisplayMode={barDisplayMode}
              zoomLevel={zoomLevel}
              gridColumns={gridColumns}
              isGridCollapsed={isGridCollapsed}
              onToggleGridCollapse={() => setIsGridCollapsed(!isGridCollapsed)}
              colors={colors}
              assetMaster={assetMaster}
              sortConfig={sortConfig}
              onSort={handleSort}
           />
         ) : (
           <MatrixView 
              assets={sortedRecords} // Renaming prop pending in MatrixView, for now passing as is
              bounds={bounds}
              grouping={grouping}
              visibleSeries={visibleSeries}
              onUpdateAsset={onUpdateAsset}
              onUpdateAssetRate={onUpdateAssetRate}
              barDisplayMode={barDisplayMode}
              onInitiateAddForecast={onInitiateAddForecast}
              gridColumns={gridColumns}
              assetMaster={assetMaster}
              classificationData={classificationData}
           />
         )}
      </>
  );
};
