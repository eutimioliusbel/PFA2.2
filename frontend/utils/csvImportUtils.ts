/**
 * CSV Import Utilities
 * Phase 1D: Large File Refactoring
 *
 * Extracts CSV parsing and import processing logic from App.tsx
 * Handles field mapping, type coercion, and record merging
 */

import type { PfaView } from '../types';

export interface FieldMapping {
  label: string;
  internalKey?: string;
  apiMap?: string;
  enabled?: boolean;
}

export interface ImportResult {
  updatedCount: number;
  newCount: number;
  processedObjects: any[];
}

/**
 * Normalize header for case-insensitive matching
 */
export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Parse CSV row with field mapping
 */
export function parseCSVRow(
  row: string[],
  headers: string[],
  mapping: FieldMapping[]
): Record<string, any> {
  const obj: Record<string, any> = {};

  headers.forEach((header, index) => {
    const cleanHeader = normalizeHeader(header);
    const fieldDef = mapping.find((f) => {
      if (!f.enabled) return false;
      const apiMapMatch = f.apiMap
        ? normalizeHeader(f.apiMap) === cleanHeader
        : false;
      const labelMatch = normalizeHeader(f.label) === cleanHeader;
      const internalMatch = f.internalKey
        ? normalizeHeader(f.internalKey) === cleanHeader
        : false;
      return apiMapMatch || labelMatch || internalMatch;
    });

    if (fieldDef && fieldDef.internalKey) {
      let value: any = row[index]?.trim();
      value = value?.replace(/^"|"$/g, '');

      // Type coercion
      if (typeof value === 'string') value = value.replace(/[$,]/g, '');
      if (
        value?.toLowerCase() === 'true' ||
        value === '1' ||
        value?.toLowerCase() === 'yes'
      )
        value = true;
      else if (
        value?.toLowerCase() === 'false' ||
        value === '0' ||
        value?.toLowerCase() === 'no'
      )
        value = false;
      else if (
        !isNaN(Number(value)) &&
        value !== '' &&
        !value.includes('-') &&
        !value.includes('/') &&
        !value.includes(',')
      )
        value = Number(value);

      // Date parsing
      if (typeof value === 'string') {
        const dateMatch = Date.parse(value);
        if (
          !isNaN(dateMatch) &&
          value.length > 5 &&
          (value.includes('-') || value.includes('/') || value.includes(','))
        ) {
          value = new Date(value);
        }
      }

      obj[fieldDef.internalKey] = value;
    }
  });

  return obj;
}

/**
 * Process PFA import and merge with existing records
 */
export function processPfaImport(
  existingRecords: PfaView[],
  importedObjects: any[]
): { newRecords: PfaView[]; updatedCount: number; newCount: number } {
  const newRecords = [...existingRecords];
  let updatedCount = 0;
  let newCount = 0;

  importedObjects.forEach((obj) => {
    if (!obj.pfaId) return;

    // Default forecast dates to original if not provided
    if (obj.originalStart && !obj.forecastStart)
      obj.forecastStart = new Date(obj.originalStart);
    if (obj.originalEnd && !obj.forecastEnd)
      obj.forecastEnd = new Date(obj.originalEnd);

    const idx = newRecords.findIndex(
      (a) => String(a.pfaId) === String(obj.pfaId)
    );

    if (idx >= 0) {
      // Update existing record
      newRecords[idx] = { ...newRecords[idx], ...obj };
      updatedCount++;
    } else {
      // Create new record with defaults
      const now = new Date();
      const newAsset: any = {
        id: `imp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
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
        ...obj,
      };

      if (obj.originalStart && !obj.forecastStart)
        newAsset.forecastStart = obj.originalStart;
      if (obj.originalEnd && !obj.forecastEnd)
        newAsset.forecastEnd = obj.originalEnd;

      newRecords.push(newAsset);
      newCount++;
    }
  });

  return { newRecords, updatedCount, newCount };
}

/**
 * Process asset master import
 */
export function processAssetImport(
  existingRecords: any[],
  importedObjects: any[]
): any[] {
  const newData = [...existingRecords];

  importedObjects.forEach((obj) => {
    if (!obj.assetTag) return;

    const idx = newData.findIndex(
      (a) => String(a.assetTag) === String(obj.assetTag)
    );

    if (idx >= 0) {
      newData[idx] = { ...newData[idx], ...obj };
    } else {
      newData.push({ id: `am-${Date.now()}-${Math.random()}`, ...obj });
    }
  });

  return newData;
}

/**
 * Process classification import
 */
export function processClassificationImport(
  existingRecords: any[],
  importedObjects: any[]
): any[] {
  const newData = [...existingRecords];

  importedObjects.forEach((obj) => {
    const idx = newData.findIndex((a) => a.classId === obj.classId);

    if (idx >= 0 && obj.classId) {
      newData[idx] = { ...newData[idx], ...obj };
    } else if (obj.classId) {
      newData.push({ id: `cc-${Date.now()}-${Math.random()}`, ...obj });
    }
  });

  return newData;
}

/**
 * Process user import
 */
export function processUserImport(
  existingRecords: any[],
  importedObjects: any[]
): any[] {
  const newData = [...existingRecords];

  importedObjects.forEach((obj) => {
    const idx = newData.findIndex((a) => a.username === obj.username);

    if (idx >= 0 && obj.username) {
      newData[idx] = { ...newData[idx], ...obj };
    } else if (obj.username) {
      newData.push({
        id: `usr-${Date.now()}-${Math.random()}`,
        themePreference: 'system',
        role: 'user',
        allowedOrganizationIds: [],
        organizationId: '',
        ...obj,
      });
    }
  });

  return newData;
}

/**
 * Process organization import
 */
export function processOrganizationImport(
  existingRecords: any[],
  importedObjects: any[]
): any[] {
  const newData = [...existingRecords];

  importedObjects.forEach((obj) => {
    const idx = newData.findIndex((a) => a.id === obj.id);

    if (idx >= 0 && obj.id) {
      newData[idx] = { ...newData[idx], ...obj };
    } else if (obj.id) {
      newData.push({
        ...obj,
        permissions: {
          viewTimeline: true,
          viewMatrix: true,
          viewGrid: true,
          canExport: true,
        },
        features: { ai: false },
        aiRules: [],
      });
    }
  });

  return newData;
}

/**
 * Process user-organization mapping import
 */
export function processUserOrgImport(
  existingUsers: any[],
  importedObjects: any[]
): any[] {
  const newData = [...existingUsers];

  importedObjects.forEach((obj) => {
    const userIdx = newData.findIndex((u) => u.username === obj.username);

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
}
