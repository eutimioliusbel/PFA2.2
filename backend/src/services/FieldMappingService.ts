/**
 * Field Mapping Service
 *
 * Contains default PEMS PFA field mappings and helper functions.
 * Used by both seed scripts and API routes.
 */

import prisma from '../config/database';

/**
 * Mapping definition type
 */
export interface FieldMappingDefinition {
  sourceField: string;
  destinationField: string;
  dataType: string;
  transformType: string;
  defaultValue: string | null;
  description: string;
}

/**
 * Default PEMS PFA field mappings
 * Maps PEMS Grid API fields to PFA mirror fields
 */
export const DEFAULT_PFA_MAPPINGS: FieldMappingDefinition[] = [
  // Core identifiers
  { sourceField: 'pfs_id', destinationField: 'pfaId', dataType: 'string', transformType: 'direct', defaultValue: null, description: 'Primary PFA identifier' },

  // Location/Classification
  { sourceField: 'pfs_f_area', destinationField: 'areaSilo', dataType: 'string', transformType: 'direct', defaultValue: '', description: 'Area/Silo location' },
  { sourceField: 'pfs_f_category', destinationField: 'category', dataType: 'string', transformType: 'direct', defaultValue: '', description: 'Equipment category' },
  { sourceField: 'pfs_f_catdesc', destinationField: 'forecastCategory', dataType: 'string', transformType: 'direct', defaultValue: null, description: 'Category description' },
  { sourceField: 'pfs_f_class', destinationField: 'class', dataType: 'string', transformType: 'direct', defaultValue: '', description: 'Equipment class' },

  // Source/Type
  { sourceField: 'pfs_f_source', destinationField: 'source', dataType: 'string', transformType: 'direct', defaultValue: 'Rental', description: 'Rental or Purchase' },
  { sourceField: 'pfs_f_dor', destinationField: 'dor', dataType: 'string', transformType: 'direct', defaultValue: 'PROJECT', description: 'BEO or PROJECT designation' },

  // Status flags (Y/N to boolean)
  { sourceField: 'pfs_f_actualized', destinationField: 'isActualized', dataType: 'boolean', transformType: 'equals_y', defaultValue: 'false', description: 'Whether item is actualized' },
  { sourceField: 'pfs_f_discontinued', destinationField: 'isDiscontinued', dataType: 'boolean', transformType: 'equals_y', defaultValue: 'false', description: 'Whether item is discontinued' },
  { sourceField: 'pfs_f_fundstrans', destinationField: 'isFundsTransferable', dataType: 'boolean', transformType: 'equals_y', defaultValue: 'false', description: 'Whether funds are transferable' },

  // Financial
  { sourceField: 'pfs_f_rental', destinationField: 'monthlyRate', dataType: 'number', transformType: 'direct', defaultValue: '0', description: 'Monthly rental rate' },
  { sourceField: 'pfs_f_purchase', destinationField: 'purchasePrice', dataType: 'number', transformType: 'direct', defaultValue: '0', description: 'Purchase price' },

  // Equipment details
  { sourceField: 'pfs_f_manufacturer', destinationField: 'manufacturer', dataType: 'string', transformType: 'direct', defaultValue: '', description: 'Equipment manufacturer' },
  { sourceField: 'pfs_f_model', destinationField: 'model', dataType: 'string', transformType: 'direct', defaultValue: '', description: 'Equipment model' },
  { sourceField: 'pfs_p_projcode', destinationField: 'contract', dataType: 'string', transformType: 'direct', defaultValue: null, description: 'Project/Contract code' },
  { sourceField: 'pfs_equipment_tag', destinationField: 'equipment', dataType: 'string', transformType: 'direct', defaultValue: null, description: 'Equipment tag/identifier' },

  // Plan dates (original/baseline)
  { sourceField: 'pfs_p_startdate', destinationField: 'originalStart', dataType: 'date', transformType: 'direct', defaultValue: null, description: 'Original plan start date' },
  { sourceField: 'pfs_p_enddate', destinationField: 'originalEnd', dataType: 'date', transformType: 'direct', defaultValue: null, description: 'Original plan end date' },

  // Forecast dates (editable)
  { sourceField: 'pfs_f_startdate', destinationField: 'forecastStart', dataType: 'date', transformType: 'direct', defaultValue: null, description: 'Forecast start date' },
  { sourceField: 'pfs_f_enddate', destinationField: 'forecastEnd', dataType: 'date', transformType: 'direct', defaultValue: null, description: 'Forecast end date' },

  // Actual dates (billing reality)
  { sourceField: 'pfs_a_startdate', destinationField: 'actualStart', dataType: 'date', transformType: 'direct', defaultValue: null, description: 'Actual start date' },
  { sourceField: 'pfs_a_enddate', destinationField: 'actualEnd', dataType: 'date', transformType: 'direct', defaultValue: null, description: 'Actual end date' },

  // Version tracking
  { sourceField: 'pfs_lastmodified', destinationField: 'pemsVersion', dataType: 'string', transformType: 'direct', defaultValue: null, description: 'PEMS last modified timestamp' }
];

/**
 * Get default mappings as array (for API responses)
 */
export function getDefaultPfaMappings(): FieldMappingDefinition[] {
  return DEFAULT_PFA_MAPPINGS;
}

/**
 * Create mappings for a specific endpoint
 */
export async function createMappingsForEndpoint(endpointId: string, createdBy: string = 'system'): Promise<number> {
  let created = 0;

  for (const mapping of DEFAULT_PFA_MAPPINGS) {
    const mappingId = `afm_${endpointId}_${mapping.sourceField}_${mapping.destinationField}`.substring(0, 64);

    try {
      await prisma.api_field_mappings.upsert({
        where: {
          endpointId_sourceField_destinationField: {
            endpointId,
            sourceField: mapping.sourceField,
            destinationField: mapping.destinationField
          }
        },
        update: {
          dataType: mapping.dataType,
          transformType: mapping.transformType,
          defaultValue: mapping.defaultValue,
          updatedAt: new Date()
        },
        create: {
          id: mappingId,
          endpointId,
          sourceField: mapping.sourceField,
          destinationField: mapping.destinationField,
          dataType: mapping.dataType,
          transformType: mapping.transformType,
          transformParams: {},
          defaultValue: mapping.defaultValue,
          isActive: true,
          validFrom: new Date(),
          validTo: null,
          createdBy,
          updatedAt: new Date()
        }
      });
      created++;
    } catch (err) {
      console.error(`Failed to create mapping ${mapping.sourceField}:`, err);
    }
  }

  return created;
}
