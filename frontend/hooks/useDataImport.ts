/**
 * useDataImport Hook
 * Phase 5: Large File Refactoring
 *
 * Handles CSV data import for PFA records and master data
 */

import { useCallback } from 'react';
import type { User, Organization, PfaView, AssetMasterRecord, ClassificationRecord, DataCategory, DataExchangeConfig } from '../types';
import { parseCSV } from '../utils/pfaHelpers';
import {
  parseCSVRow,
  processPfaImport,
  processAssetImport,
  processClassificationImport,
  processUserImport,
  processOrganizationImport,
  processUserOrgImport,
} from '../utils/csvImportUtils';

interface UseDataImportProps {
  exportConfig: DataExchangeConfig;
  setIsSubmitting: (submitting: boolean) => void;
  setLoadingMessage: (message: string | null) => void;
  updatePfaRecords: (fn: (assets: PfaView[]) => PfaView[]) => void;
  setAssetMasterData: React.Dispatch<React.SetStateAction<AssetMasterRecord[]>>;
  setClassificationData: React.Dispatch<React.SetStateAction<ClassificationRecord[]>>;
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setOrgs: React.Dispatch<React.SetStateAction<Organization[]>>;
}

interface UseDataImportReturn {
  handleDataImport: (file: File, type: string) => Promise<void>;
}

export function useDataImport({
  exportConfig,
  setIsSubmitting,
  setLoadingMessage,
  updatePfaRecords,
  setAssetMasterData,
  setClassificationData,
  setUsers,
  setOrgs,
}: UseDataImportProps): UseDataImportReturn {
  const handleDataImport = useCallback(
    async (file: File, type: string) => {
      setIsSubmitting(true);
      setLoadingMessage('Parsing Import File...');
      setTimeout(async () => {
        try {
          const text = await file.text();
          const rows = parseCSV(text);
          if (rows.length < 1) throw new Error('Empty file');
          const headers = rows[0].map((h) => h.trim().replace(/^"|"$/g, ''));
          const dataRows = rows.slice(1);
          setLoadingMessage(`Processing ${dataRows.length} records...`);
          const mapping = exportConfig.fields[type as DataCategory];
          if (!mapping) {
            alert(`No field mapping configured for import type: ${type}`);
            setIsSubmitting(false);
            setLoadingMessage(null);
            return;
          }

          // Parse CSV rows using utility function
          const parsedObjects = dataRows.map((row) => parseCSVRow(row, headers, mapping));
          const validObjects = parsedObjects.filter((o) => Object.keys(o).length > 0);

          // Process import based on type using utility functions
          switch (type) {
            case 'pfa_import':
              updatePfaRecords((prev) => {
                const { newRecords, updatedCount, newCount } = processPfaImport(prev, validObjects);
                setLoadingMessage(`Updated ${updatedCount}, Created ${newCount} records.`);
                return newRecords;
              });
              break;
            case 'assets_import':
              setAssetMasterData((prev) => processAssetImport(prev, validObjects));
              break;
            case 'class_cat_import':
              setClassificationData((prev) => processClassificationImport(prev, validObjects));
              break;
            case 'users_import':
              setUsers((prev) => processUserImport(prev, validObjects));
              break;
            case 'orgs_import':
              setOrgs((prev) => processOrganizationImport(prev, validObjects));
              break;
            case 'user_orgs_import':
              setUsers((prev) => processUserOrgImport(prev, validObjects));
              break;
          }

          setTimeout(() => {
            setIsSubmitting(false);
            setLoadingMessage(null);
            alert(`Successfully processed ${validObjects.length} rows.`);
          }, 500);
        } catch (e) {
          console.error('Import Failed', e);
          setIsSubmitting(false);
          setLoadingMessage(null);
          alert('Failed to import file. Please check format (CSV required).');
        }
      }, 100);
    },
    [
      exportConfig,
      setIsSubmitting,
      setLoadingMessage,
      updatePfaRecords,
      setAssetMasterData,
      setClassificationData,
      setUsers,
      setOrgs,
    ]
  );

  return { handleDataImport };
}
