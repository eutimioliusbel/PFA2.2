/**
 * @file masterDataRoutes.ts
 * @description Routes for Master Data management
 * Provides endpoints for manufacturers, models, DORs, sources, and classifications
 */

import { Router } from 'express';
import { MasterDataController } from '../controllers/masterDataController';
import { requirePermission, requirePermissionGlobal } from '../middleware/requirePermission';

const router = Router();

// ============================================================================
// READ ENDPOINTS - GLOBAL (no org required)
// Classes, Categories, Manufacturers, Models, DORs, Sources are system-wide
// ============================================================================

/**
 * GET /api/master-data/all
 * Get all master data in a single request (global)
 */
router.get('/all', requirePermissionGlobal('perm_Read'), MasterDataController.getAllMasterData);

/**
 * GET /api/master-data/manufacturers
 * Get all manufacturers (global)
 */
router.get('/manufacturers', requirePermissionGlobal('perm_Read'), MasterDataController.getManufacturers);

/**
 * GET /api/master-data/models
 * Get all models (global, optionally filtered by manufacturer)
 */
router.get('/models', requirePermissionGlobal('perm_Read'), MasterDataController.getModels);

/**
 * GET /api/master-data/dors
 * Get all DORs (global)
 */
router.get('/dors', requirePermissionGlobal('perm_Read'), MasterDataController.getDors);

/**
 * GET /api/master-data/sources
 * Get all sources (global)
 */
router.get('/sources', requirePermissionGlobal('perm_Read'), MasterDataController.getSources);

/**
 * GET /api/master-data/classifications
 * Get all class/category combinations (global)
 */
router.get('/classifications', requirePermissionGlobal('perm_Read'), MasterDataController.getClassifications);

/**
 * GET /api/master-data/classes
 * Get distinct classes (global)
 */
router.get('/classes', requirePermissionGlobal('perm_Read'), MasterDataController.getClasses);

/**
 * GET /api/master-data/categories
 * Get categories (global, optionally filtered by class)
 */
router.get('/categories', requirePermissionGlobal('perm_Read'), MasterDataController.getCategories);

// ============================================================================
// READ ENDPOINTS - ORG-SPECIFIC
// Area Silos are organization-specific
// ============================================================================

/**
 * GET /api/master-data/area-silos
 * Get area silos (org-specific, filtered by organization)
 */
router.get('/area-silos', requirePermission('perm_Read'), MasterDataController.getAreaSilos);

// ============================================================================
// WRITE ENDPOINTS - GLOBAL (no org required)
// ============================================================================

/**
 * POST /api/master-data/manufacturers
 * Create a new manufacturer (global)
 */
router.post('/manufacturers', requirePermissionGlobal('perm_ManageSettings'), MasterDataController.createManufacturer);

/**
 * POST /api/master-data/models
 * Create a new model (global)
 */
router.post('/models', requirePermissionGlobal('perm_ManageSettings'), MasterDataController.createModel);

/**
 * POST /api/master-data/dors
 * Create a new DOR (global)
 */
router.post('/dors', requirePermissionGlobal('perm_ManageSettings'), MasterDataController.createDor);

/**
 * POST /api/master-data/sources
 * Create a new source (global)
 */
router.post('/sources', requirePermissionGlobal('perm_ManageSettings'), MasterDataController.createSource);

/**
 * POST /api/master-data/classifications
 * Create a new classification (global)
 */
router.post('/classifications', requirePermissionGlobal('perm_ManageSettings'), MasterDataController.createClassification);

// ============================================================================
// WRITE ENDPOINTS - ORG-SPECIFIC
// ============================================================================

/**
 * POST /api/master-data/area-silos
 * Create a new area silo for an organization (org-specific)
 */
router.post('/area-silos', requirePermission('perm_ManageSettings'), MasterDataController.createAreaSilo);

export default router;
