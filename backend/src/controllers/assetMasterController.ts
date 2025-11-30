/**
 * @file assetMasterController.ts
 * @description Asset Master Controller - Equipment registry from PEMS
 *
 * Provides API endpoints for accessing the asset_master table which stores
 * equipment data synced from PEMS API (Assets endpoint).
 *
 * Architecture:
 * - GET  /api/assets/:orgId             - Get paginated asset list for organization
 * - GET  /api/assets/:orgId/search      - Search assets with filters
 * - GET  /api/assets/:orgId/:assetCode  - Get single asset by code
 *
 * Security:
 * - All endpoints require authentication
 * - Organization isolation enforced via middleware
 */

import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// ============================================================================
// GET /api/assets/:orgId - Get paginated asset list
// ============================================================================

/**
 * Get asset master records for an organization with pagination and filtering
 *
 * Query params:
 * - page: Page number (default: 1)
 * - pageSize: Records per page (default: 100, max: 1000)
 * - status: Equipment status filter (e.g., "In Use", "Available")
 * - category: Category code filter
 * - manufacturer: Manufacturer filter
 * - search: Full-text search on assetCode, description, serialNumber
 */
export const getAssetMaster = async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  const { orgId } = req.params;
  const userId = req.user?.userId;

  logger.info(`[AssetMasterController] GET /api/assets/${orgId}`, { userId });

  try {
    // Get organization ID from code
    const organization = await prisma.organizations.findUnique({
      where: { code: orgId },
      select: { id: true, code: true }
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Extract query params
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(1000, Math.max(1, parseInt(req.query.pageSize as string) || 100));
    const status = req.query.status as string;
    const category = req.query.category as string;
    const manufacturer = req.query.manufacturer as string;
    const search = req.query.search as string;

    // Build where clause
    const where: any = {
      organizationId: organization.id
    };

    if (status) {
      where.equipmentStatus = status;
    }

    if (category) {
      where.category = category;
    }

    if (manufacturer) {
      where.manufacturer = { contains: manufacturer, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { assetCode: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { alias: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Execute query with count
    const [assets, total] = await Promise.all([
      prisma.asset_master.findMany({
        where,
        orderBy: { assetCode: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.asset_master.count({ where })
    ]);

    // Transform for API response - add organization code for display
    const response = assets.map(asset => ({
      ...asset,
      organization: organization.code,
      assetTag: asset.assetCode // Backward compatibility alias
    }));

    const duration = Date.now() - startTime;

    logger.info(`[AssetMasterController] Returned ${assets.length}/${total} assets in ${duration}ms`);

    return res.json({
      success: true,
      data: response,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      },
      meta: {
        responseTimeMs: duration
      }
    });

  } catch (error: any) {
    logger.error(`[AssetMasterController] Error fetching assets`, { error: error.message, orgId });
    return res.status(500).json({ error: 'Failed to fetch asset master data' });
  }
};

// ============================================================================
// GET /api/assets/:orgId/:assetCode - Get single asset
// ============================================================================

export const getAssetByCode = async (req: AuthRequest, res: Response) => {
  const { orgId, assetCode } = req.params;
  const userId = req.user?.userId;

  logger.info(`[AssetMasterController] GET /api/assets/${orgId}/${assetCode}`, { userId });

  try {
    // Get organization ID from code
    const organization = await prisma.organizations.findUnique({
      where: { code: orgId },
      select: { id: true, code: true }
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const asset = await prisma.asset_master.findUnique({
      where: {
        organizationId_assetCode: {
          organizationId: organization.id,
          assetCode
        }
      }
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    return res.json({
      success: true,
      data: {
        ...asset,
        organization: organization.code,
        assetTag: asset.assetCode
      }
    });

  } catch (error: any) {
    logger.error(`[AssetMasterController] Error fetching asset`, { error: error.message, orgId, assetCode });
    return res.status(500).json({ error: 'Failed to fetch asset' });
  }
};

// ============================================================================
// GET /api/assets/:orgId/stats - Get asset statistics
// ============================================================================

export const getAssetStats = async (req: AuthRequest, res: Response) => {
  const { orgId } = req.params;
  const userId = req.user?.userId;

  logger.info(`[AssetMasterController] GET /api/assets/${orgId}/stats`, { userId });

  try {
    // Get organization ID from code
    const organization = await prisma.organizations.findUnique({
      where: { code: orgId },
      select: { id: true }
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get aggregated stats
    const [
      totalCount,
      byStatus,
      bySource,
      byManufacturer
    ] = await Promise.all([
      prisma.asset_master.count({ where: { organizationId: organization.id } }),
      prisma.asset_master.groupBy({
        by: ['equipmentStatus'],
        where: { organizationId: organization.id },
        _count: { id: true }
      }),
      prisma.asset_master.groupBy({
        by: ['source'],
        where: { organizationId: organization.id },
        _count: { id: true }
      }),
      prisma.asset_master.groupBy({
        by: ['manufacturer'],
        where: { organizationId: organization.id },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10
      })
    ]);

    return res.json({
      success: true,
      data: {
        total: totalCount,
        byStatus: byStatus.map(s => ({ status: s.equipmentStatus || 'Unknown', count: s._count.id })),
        bySource: bySource.map(s => ({ source: s.source || 'Unknown', count: s._count.id })),
        topManufacturers: byManufacturer.map(m => ({ manufacturer: m.manufacturer || 'Unknown', count: m._count.id }))
      }
    });

  } catch (error: any) {
    logger.error(`[AssetMasterController] Error fetching stats`, { error: error.message, orgId });
    return res.status(500).json({ error: 'Failed to fetch asset statistics' });
  }
};

// ============================================================================
// GET /api/assets/all - Get all assets (for admin/cross-org views)
// ============================================================================

export const getAllAssets = async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  const userId = req.user?.userId;

  logger.info(`[AssetMasterController] GET /api/assets/all`, { userId });

  try {
    // Extract query params
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(1000, Math.max(1, parseInt(req.query.pageSize as string) || 100));
    const search = req.query.search as string;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { assetCode: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Execute query with count and org lookup
    const [assets, total] = await Promise.all([
      prisma.asset_master.findMany({
        where,
        include: {
          organization: { select: { code: true, name: true } }
        },
        orderBy: [{ organizationId: 'asc' }, { assetCode: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.asset_master.count({ where })
    ]);

    // Transform for API response
    const response = assets.map(asset => ({
      ...asset,
      organization: asset.organization.code,
      assetTag: asset.assetCode
    }));

    const duration = Date.now() - startTime;

    return res.json({
      success: true,
      data: response,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      },
      meta: {
        responseTimeMs: duration
      }
    });

  } catch (error: any) {
    logger.error(`[AssetMasterController] Error fetching all assets`, { error: error.message });
    return res.status(500).json({ error: 'Failed to fetch asset master data' });
  }
};
