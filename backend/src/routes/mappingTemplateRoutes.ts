/**
 * @file mappingTemplateRoutes.ts
 * @description Mapping Template routes - ADR-007 Task 5.2 Enhancement 5
 * Save/load reusable mapping configurations
 */

import { Router, Request, Response } from 'express';
import { requirePermissionGlobal } from '../middleware/requirePermission';
import prisma from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/mapping-templates
 * List all mapping templates
 */
router.get(
  '/api/mapping-templates',
  requirePermissionGlobal('perm_Read'),
  async (_req: Request, res: Response) => {
    try {
      // Use Prisma ORM instead of raw SQL
      const templates = await prisma.mapping_templates.findMany({
        orderBy: { createdAt: 'desc' }
      });

      res.json({
        success: true,
        templates: templates || []
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[TEMPLATE_LIST] Failed to list templates', { error: errorMsg });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: errorMsg
      });
    }
  }
);

/**
 * POST /api/mapping-templates
 * Create a new mapping template
 */
router.post(
  '/api/mapping-templates',
  requirePermissionGlobal('perm_ManageSettings'),
  async (req: Request, res: Response) => {
    try {
      const { name, description, entity, mappings, isPublic } = req.body;
      const user = (req as any).user;

      if (!name || !mappings || !Array.isArray(mappings)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'name and mappings array required'
        });
      }

      // Use Prisma ORM instead of raw SQL
      const template = await prisma.mapping_templates.create({
        data: {
          name,
          description: description || null,
          entity: entity || 'PFA',
          mappings: mappings,
          isPublic: isPublic || false,
          createdBy: user.userId
        }
      });

      logger.info('[TEMPLATE_CREATE] Template created', {
        templateId: template.id,
        name,
        userId: user.userId
      });

      return res.status(201).json({
        success: true,
        template
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[TEMPLATE_CREATE] Failed to create template', { error: errorMsg });

      return res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: errorMsg
      });
    }
  }
);

/**
 * GET /api/mapping-templates/:id
 * Get a specific mapping template
 */
router.get(
  '/api/mapping-templates/:id',
  requirePermissionGlobal('perm_Read'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Use Prisma ORM instead of raw SQL
      const template = await prisma.mapping_templates.findUnique({
        where: { id }
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Template not found'
        });
      }

      return res.json({
        success: true,
        template
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[TEMPLATE_GET] Failed to get template', { error: errorMsg });

      return res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: errorMsg
      });
    }
  }
);

/**
 * DELETE /api/mapping-templates/:id
 * Delete a mapping template
 */
router.delete(
  '/api/mapping-templates/:id',
  requirePermissionGlobal('perm_ManageSettings'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Use Prisma ORM instead of raw SQL
      await prisma.mapping_templates.delete({
        where: { id }
      });

      logger.info('[TEMPLATE_DELETE] Template deleted', { templateId: id });

      res.json({
        success: true,
        message: 'Template deleted'
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[TEMPLATE_DELETE] Failed to delete template', { error: errorMsg });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: errorMsg
      });
    }
  }
);

export default router;
