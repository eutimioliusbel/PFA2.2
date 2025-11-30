/**
 * @file masterDataController.ts
 * @description REST API controller for Master Data management
 * Provides endpoints for manufacturers, models, DORs, sources, and class/categories
 */

import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import prisma from '../config/database';
import { handleControllerError } from '../utils/errorHandling';

export class MasterDataController {
  // ============================================================================
  // MANUFACTURERS
  // ============================================================================

  /**
   * GET /api/master-data/manufacturers
   * Get all active manufacturers
   */
  static async getManufacturers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const includeInactive = req.query.includeInactive === 'true';

      const manufacturers = await prisma.master_manufacturers.findMany({
        where: includeInactive ? {} : { isActive: true },
        orderBy: { code: 'asc' },
        select: {
          id: true,
          code: true,
          description: true,
          isActive: true,
        },
      });

      res.json({
        success: true,
        data: manufacturers,
        count: manufacturers.length,
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'MasterDataController.getManufacturers');
    }
  }

  /**
   * POST /api/master-data/manufacturers
   * Create a new manufacturer
   */
  static async createManufacturer(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { code, description } = req.body;

      if (!code) {
        res.status(400).json({ success: false, error: 'Manufacturer code is required' });
        return;
      }

      const manufacturer = await prisma.master_manufacturers.create({
        data: {
          code: code.toUpperCase(),
          description,
        },
      });

      res.status(201).json({
        success: true,
        data: manufacturer,
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'MasterDataController.createManufacturer');
    }
  }

  // ============================================================================
  // MODELS
  // ============================================================================

  /**
   * GET /api/master-data/models
   * Get all active models, optionally filtered by manufacturer
   */
  static async getModels(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { manufacturer } = req.query;
      const includeInactive = req.query.includeInactive === 'true';

      const where: any = includeInactive ? {} : { isActive: true };
      if (manufacturer) {
        where.manufacturer = String(manufacturer).toUpperCase();
      }

      const models = await prisma.master_models.findMany({
        where,
        orderBy: [{ manufacturer: 'asc' }, { model: 'asc' }],
        select: {
          id: true,
          manufacturer: true,
          model: true,
          description: true,
          isActive: true,
        },
      });

      res.json({
        success: true,
        data: models,
        count: models.length,
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'MasterDataController.getModels');
    }
  }

  /**
   * POST /api/master-data/models
   * Create a new model
   */
  static async createModel(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { manufacturer, model, description } = req.body;

      if (!manufacturer || !model) {
        res.status(400).json({ success: false, error: 'Manufacturer and model are required' });
        return;
      }

      const newModel = await prisma.master_models.create({
        data: {
          manufacturer: manufacturer.toUpperCase(),
          model: model.toUpperCase(),
          description,
        },
      });

      res.status(201).json({
        success: true,
        data: newModel,
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'MasterDataController.createModel');
    }
  }

  // ============================================================================
  // DORs
  // ============================================================================

  /**
   * GET /api/master-data/dors
   * Get all active DORs
   */
  static async getDors(req: AuthRequest, res: Response): Promise<void> {
    try {
      const includeInactive = req.query.includeInactive === 'true';

      const dors = await prisma.master_dors.findMany({
        where: includeInactive ? {} : { isActive: true },
        orderBy: { code: 'asc' },
        select: {
          id: true,
          code: true,
          description: true,
          isActive: true,
        },
      });

      res.json({
        success: true,
        data: dors,
        count: dors.length,
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'MasterDataController.getDors');
    }
  }

  /**
   * POST /api/master-data/dors
   * Create a new DOR
   */
  static async createDor(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { code, description } = req.body;

      if (!code) {
        res.status(400).json({ success: false, error: 'DOR code is required' });
        return;
      }

      const dor = await prisma.master_dors.create({
        data: {
          code: code.toUpperCase(),
          description,
        },
      });

      res.status(201).json({
        success: true,
        data: dor,
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'MasterDataController.createDor');
    }
  }

  // ============================================================================
  // SOURCES
  // ============================================================================

  /**
   * GET /api/master-data/sources
   * Get all active sources
   */
  static async getSources(req: AuthRequest, res: Response): Promise<void> {
    try {
      const includeInactive = req.query.includeInactive === 'true';

      const sources = await prisma.master_sources.findMany({
        where: includeInactive ? {} : { isActive: true },
        orderBy: { code: 'asc' },
        select: {
          id: true,
          code: true,
          description: true,
          type: true,
          isActive: true,
        },
      });

      res.json({
        success: true,
        data: sources,
        count: sources.length,
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'MasterDataController.getSources');
    }
  }

  /**
   * POST /api/master-data/sources
   * Create a new source
   */
  static async createSource(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { code, description, type } = req.body;

      if (!code) {
        res.status(400).json({ success: false, error: 'Source code is required' });
        return;
      }

      const source = await prisma.master_sources.create({
        data: {
          code: code.toUpperCase(),
          description,
          type,
        },
      });

      res.status(201).json({
        success: true,
        data: source,
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'MasterDataController.createSource');
    }
  }

  // ============================================================================
  // CLASS/CATEGORIES
  // ============================================================================

  /**
   * GET /api/master-data/classifications
   * Get all active class/category combinations
   */
  static async getClassifications(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { classCode } = req.query;
      const includeInactive = req.query.includeInactive === 'true';

      const where: any = includeInactive ? {} : { isActive: true };
      if (classCode) {
        where.classCode = String(classCode);
      }

      const classifications = await prisma.master_class_categories.findMany({
        where,
        orderBy: [{ classCode: 'asc' }, { categoryCode: 'asc' }],
        select: {
          id: true,
          classCode: true,
          classDescription: true,
          categoryCode: true,
          categoryDescription: true,
          isActive: true,
        },
      });

      res.json({
        success: true,
        data: classifications,
        count: classifications.length,
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'MasterDataController.getClassifications');
    }
  }

  /**
   * GET /api/master-data/classes
   * Get distinct classes (for class dropdown)
   */
  static async getClasses(req: AuthRequest, res: Response): Promise<void> {
    try {
      const includeInactive = req.query.includeInactive === 'true';

      const classifications = await prisma.master_class_categories.findMany({
        where: includeInactive ? {} : { isActive: true },
        select: {
          classCode: true,
          classDescription: true,
        },
        distinct: ['classCode'],
        orderBy: { classCode: 'asc' },
      });

      res.json({
        success: true,
        data: classifications,
        count: classifications.length,
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'MasterDataController.getClasses');
    }
  }

  /**
   * GET /api/master-data/categories
   * Get categories, optionally filtered by class
   */
  static async getCategories(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { classCode } = req.query;
      const includeInactive = req.query.includeInactive === 'true';

      const where: any = includeInactive ? {} : { isActive: true };
      if (classCode) {
        where.classCode = String(classCode);
      }

      const categories = await prisma.master_class_categories.findMany({
        where,
        select: {
          categoryCode: true,
          categoryDescription: true,
          classCode: true,
        },
        orderBy: { categoryCode: 'asc' },
      });

      res.json({
        success: true,
        data: categories,
        count: categories.length,
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'MasterDataController.getCategories');
    }
  }

  /**
   * POST /api/master-data/classifications
   * Create a new class/category combination
   */
  static async createClassification(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { classCode, classDescription, categoryCode, categoryDescription } = req.body;

      if (!classCode || !categoryCode) {
        res.status(400).json({ success: false, error: 'Class code and category code are required' });
        return;
      }

      const classification = await prisma.master_class_categories.create({
        data: {
          classCode,
          classDescription,
          categoryCode,
          categoryDescription,
        },
      });

      res.status(201).json({
        success: true,
        data: classification,
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'MasterDataController.createClassification');
    }
  }

  // ============================================================================
  // AREA SILOS (Organization-specific)
  // ============================================================================

  /**
   * GET /api/master-data/area-silos
   * Get area silos for a specific organization or all accessible organizations
   */
  static async getAreaSilos(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { organizationId } = req.query;
      const includeInactive = req.query.includeInactive === 'true';

      const where: Record<string, unknown> = includeInactive ? {} : { isActive: true };
      if (organizationId) {
        where.organizationId = String(organizationId);
      }

      const areaSilos = await prisma.master_area_silos.findMany({
        where,
        orderBy: [{ organizationId: 'asc' }, { areaSilo: 'asc' }],
        select: {
          id: true,
          organizationId: true,
          areaSilo: true,
          description: true,
          isActive: true,
          organization: {
            select: { code: true, name: true },
          },
        },
      });

      res.json({
        success: true,
        data: areaSilos,
        count: areaSilos.length,
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'MasterDataController.getAreaSilos');
    }
  }

  /**
   * POST /api/master-data/area-silos
   * Create a new area silo for an organization
   */
  static async createAreaSilo(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { organizationId, areaSilo, description } = req.body;

      if (!organizationId || !areaSilo) {
        res.status(400).json({ success: false, error: 'Organization ID and area silo code are required' });
        return;
      }

      const newAreaSilo = await prisma.master_area_silos.create({
        data: {
          organizationId,
          areaSilo: areaSilo.toUpperCase(),
          description,
        },
      });

      res.status(201).json({
        success: true,
        data: newAreaSilo,
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'MasterDataController.createAreaSilo');
    }
  }

  // ============================================================================
  // COMBINED / ALL MASTER DATA
  // ============================================================================

  /**
   * GET /api/master-data/all
   * Get all master data in a single request (for initial load)
   */
  static async getAllMasterData(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { organizationId } = req.query;

      const [manufacturers, models, dors, sources, classifications, areaSilos] = await Promise.all([
        prisma.master_manufacturers.findMany({
          where: { isActive: true },
          orderBy: { code: 'asc' },
          select: { id: true, code: true, description: true },
        }),
        prisma.master_models.findMany({
          where: { isActive: true },
          orderBy: [{ manufacturer: 'asc' }, { model: 'asc' }],
          select: { id: true, manufacturer: true, model: true, description: true },
        }),
        prisma.master_dors.findMany({
          where: { isActive: true },
          orderBy: { code: 'asc' },
          select: { id: true, code: true, description: true },
        }),
        prisma.master_sources.findMany({
          where: { isActive: true },
          orderBy: { code: 'asc' },
          select: { id: true, code: true, description: true, type: true },
        }),
        prisma.master_class_categories.findMany({
          where: { isActive: true },
          orderBy: [{ classCode: 'asc' }, { categoryCode: 'asc' }],
          select: {
            id: true,
            classCode: true,
            classDescription: true,
            categoryCode: true,
            categoryDescription: true,
          },
        }),
        prisma.master_area_silos.findMany({
          where: organizationId
            ? { isActive: true, organizationId: String(organizationId) }
            : { isActive: true },
          orderBy: [{ organizationId: 'asc' }, { areaSilo: 'asc' }],
          select: {
            id: true,
            organizationId: true,
            areaSilo: true,
            description: true,
          },
        }),
      ]);

      res.json({
        success: true,
        data: {
          manufacturers,
          models,
          dors,
          sources,
          classifications,
          areaSilos,
        },
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'MasterDataController.getAllMasterData');
    }
  }
}

export default MasterDataController;
