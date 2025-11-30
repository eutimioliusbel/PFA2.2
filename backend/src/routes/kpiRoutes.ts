/**
 * KPI Routes - ADR-007
 *
 * API endpoints for KPI management and calculation.
 * Supports formula validation, CRUD operations, and execution.
 *
 * @see ADR-007-AGENT_WORKFLOW.md Task 4.1
 */

import express, { Request, Response, Router } from 'express';
import { requirePermission } from '../middleware/requirePermission';
import { kpiCalculator } from '../services/kpi/KpiCalculator';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router: Router = express.Router();

/**
 * GET /api/kpis
 * List all KPIs for an organization
 */
router.get(
  '/',
  requirePermission('perm_Read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const organizationId = req.query.organizationId as string || user.organizationId;

      const kpis = await prisma.kpi_definitions.findMany({
        where: {
          organizationId,
          isActive: true
        },
        orderBy: { sortOrder: 'asc' }
      });

      res.json({
        success: true,
        kpis: kpis.map((kpi: any) => ({
          id: kpi.id,
          name: kpi.name,
          description: kpi.description,
          formula: kpi.formula,
          formulaType: kpi.formulaType,
          format: kpi.format,
          colorScale: kpi.colorScale,
          sortOrder: kpi.sortOrder,
          executionCount: kpi.executionCount,
          avgExecutionTime: kpi.avgExecutionTime,
          lastExecutedAt: kpi.lastExecutedAt
        }))
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[KPI] Failed to list KPIs`, { error: errorMsg });

      res.status(500).json({
        success: false,
        error: errorMsg
      });
    }
  }
);

/**
 * GET /api/kpis/:id
 * Get single KPI by ID
 */
router.get(
  '/:id',
  requirePermission('perm_Read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const kpi = await prisma.kpi_definitions.findUnique({
        where: { id }
      });

      if (!kpi) {
        res.status(404).json({
          success: false,
          error: 'KPI not found'
        });
        return;
      }

      res.json({
        success: true,
        kpi
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[KPI] Failed to get KPI`, { error: errorMsg });

      res.status(500).json({
        success: false,
        error: errorMsg
      });
    }
  }
);

/**
 * POST /api/kpis
 * Create new KPI
 *
 * Body: { name, formula, description?, format?, colorScale?, sortOrder? }
 */
router.post(
  '/',
  requirePermission('perm_ManageSettings'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const organizationId = req.body.organizationId || user.organizationId;
      const { name, formula, description, format, colorScale, sortOrder } = req.body;

      // Validate formula
      const validation = kpiCalculator.validateFormula(formula);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: 'Invalid formula',
          details: validation.error
        });
        return;
      }

      // Validate name
      if (!name || name.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'KPI name is required'
        });
        return;
      }

      // Sanitize name (prevent XSS)
      const sanitizedName = name.replace(/<[^>]*>/g, '').trim();

      const kpi = await prisma.kpi_definitions.create({
        data: {
          id: uuidv4(),
          organizationId,
          name: sanitizedName,
          formula,
          description: description || null,
          formulaType: 'mathjs',
          format: format || 'number',
          colorScale: colorScale || false,
          sortOrder: sortOrder || 0,
          createdBy: user.userId,
          isActive: true,
          updatedAt: new Date()
        }
      });

      logger.info(`[KPI] Created KPI`, {
        kpiId: kpi.id,
        name: kpi.name,
        organizationId
      });

      res.status(201).json({
        success: true,
        kpi
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[KPI] Failed to create KPI`, { error: errorMsg });

      res.status(500).json({
        success: false,
        error: errorMsg
      });
    }
  }
);

/**
 * PUT /api/kpis/:id
 * Update existing KPI
 */
router.put(
  '/:id',
  requirePermission('perm_ManageSettings'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, formula, description, format, colorScale, sortOrder, isActive } = req.body;

      // Check KPI exists
      const existing = await prisma.kpi_definitions.findUnique({
        where: { id }
      });

      if (!existing) {
        res.status(404).json({
          success: false,
          error: 'KPI not found'
        });
        return;
      }

      // Validate formula if provided
      if (formula) {
        const validation = kpiCalculator.validateFormula(formula);
        if (!validation.valid) {
          res.status(400).json({
            success: false,
            error: 'Invalid formula',
            details: validation.error
          });
          return;
        }
      }

      // Sanitize name if provided
      const sanitizedName = name ? name.replace(/<[^>]*>/g, '').trim() : undefined;

      const kpi = await prisma.kpi_definitions.update({
        where: { id },
        data: {
          ...(sanitizedName && { name: sanitizedName }),
          ...(formula && { formula }),
          ...(description !== undefined && { description }),
          ...(format && { format }),
          ...(colorScale !== undefined && { colorScale }),
          ...(sortOrder !== undefined && { sortOrder }),
          ...(isActive !== undefined && { isActive })
        }
      });

      logger.info(`[KPI] Updated KPI`, { kpiId: id });

      res.json({
        success: true,
        kpi
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[KPI] Failed to update KPI`, { error: errorMsg });

      res.status(500).json({
        success: false,
        error: errorMsg
      });
    }
  }
);

/**
 * DELETE /api/kpis/:id
 * Soft-delete KPI (mark as inactive)
 */
router.delete(
  '/:id',
  requirePermission('perm_ManageSettings'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      await prisma.kpi_definitions.update({
        where: { id },
        data: { isActive: false }
      });

      logger.info(`[KPI] Deleted KPI`, { kpiId: id });

      res.json({
        success: true,
        message: 'KPI deleted'
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[KPI] Failed to delete KPI`, { error: errorMsg });

      res.status(500).json({
        success: false,
        error: errorMsg
      });
    }
  }
);

/**
 * POST /api/kpis/:id/calculate
 * Calculate KPI value for organization
 */
router.post(
  '/:id/calculate',
  requirePermission('perm_Read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const organizationId = req.body.organizationId || user.organizationId;

      const result = await kpiCalculator.calculate(id, organizationId, user.userId);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json(result);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[KPI] Calculation failed`, { error: errorMsg });

      res.status(500).json({
        success: false,
        error: errorMsg
      });
    }
  }
);

/**
 * POST /api/kpis/validate
 * Validate formula syntax without saving
 *
 * Body: { formula }
 */
router.post(
  '/validate',
  requirePermission('perm_Read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { formula } = req.body;

      if (!formula) {
        res.status(400).json({
          success: false,
          error: 'Formula is required'
        });
        return;
      }

      const validation = kpiCalculator.validateFormula(formula);

      res.json({
        success: true,
        validation
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: errorMsg
      });
    }
  }
);

/**
 * POST /api/kpis/test
 * Test formula with sample record data
 *
 * Body: { formula, sampleRecord }
 */
router.post(
  '/test',
  requirePermission('perm_Read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { formula, sampleRecord } = req.body;

      if (!formula) {
        res.status(400).json({
          success: false,
          error: 'Formula is required'
        });
        return;
      }

      const testRecord = sampleRecord || {
        monthlyRate: 1000,
        purchasePrice: 50000,
        cost: 1000,
        quantity: 1
      };

      const result = kpiCalculator.testFormula(formula, testRecord);

      res.json({
        success: true,
        result,
        sampleRecord: testRecord
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: errorMsg
      });
    }
  }
);

/**
 * GET /api/kpis/fields
 * Get available fields for formula builder autocomplete
 */
router.get(
  '/fields/available',
  requirePermission('perm_Read'),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const fields = kpiCalculator.getAvailableFields();
      const examples = kpiCalculator.getExampleFormulas();

      res.json({
        success: true,
        fields,
        examples
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: errorMsg
      });
    }
  }
);

/**
 * GET /api/kpis/:id/history
 * Get execution history for a KPI
 */
router.get(
  '/:id/history',
  requirePermission('perm_Read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const limit = Math.min(Number(req.query.limit) || 50, 100);

      const history = await prisma.kpi_execution_logs.findMany({
        where: { kpiId: id },
        orderBy: { executedAt: 'desc' },
        take: limit
      });

      res.json({
        success: true,
        history: history.map((h: any) => ({
          id: h.id,
          executedAt: h.executedAt,
          inputRecordCount: h.inputRecordCount,
          outputValue: h.outputValue,
          executionTime: h.executionTime,
          userRating: h.userRating
        }))
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: errorMsg
      });
    }
  }
);

/**
 * POST /api/kpis/execute/:id/rate
 * Rate a KPI execution (user feedback for AI learning)
 *
 * Body: { executionId, rating (1-5) }
 */
router.post(
  '/execute/:executionId/rate',
  requirePermission('perm_Read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { executionId } = req.params;
      const { rating } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        res.status(400).json({
          success: false,
          error: 'Rating must be between 1 and 5'
        });
        return;
      }

      await prisma.kpi_execution_logs.update({
        where: { id: executionId },
        data: { userRating: rating }
      });

      logger.info(`[KPI] Rated execution`, { executionId, rating });

      res.json({
        success: true,
        message: 'Rating saved'
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: errorMsg
      });
    }
  }
);

export default router;
