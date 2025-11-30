// backend/src/controllers/financialMaskingController.ts
/**
 * Financial Masking Controller
 *
 * Phase 7, Task 7.2 of ADR-005 Multi-Tenant Access Control
 * AI Use Case 17: Financial Data Masking with Relative Indicators
 *
 * API endpoints for financial data masking operations.
 * Enforces viewFinancialDetails permission and provides
 * relative indicators for masked users.
 */

import { Request, Response } from 'express';
import prisma from '../config/database';
import { financialMaskingService, PfaRecordForMasking } from '../services/ai/FinancialMaskingService';
import { logger } from '../utils/logger';
import { handleControllerError } from '../utils/errorHandling';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
    organizations: Array<{
      organizationId: string;
      organizationCode: string;
      role: string;
      permissions: Record<string, boolean>;
    }>;
  };
}

// ============================================================================
// Controllers
// ============================================================================

/**
 * GET /api/financial/masked-records
 *
 * Get PFA records with automatic financial masking based on user permissions.
 * Users without viewFinancialDetails will receive masked costs with relative indicators.
 *
 * Query params:
 * - organizationId: string (required)
 * - category?: string[] (optional filter)
 * - class?: string[] (optional filter)
 * - limit?: number (default 100)
 * - offset?: number (default 0)
 */
export async function getMaskedPfaRecords(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const { organizationId, category, limit = '100', offset = '0' } = req.query;

    if (!organizationId || typeof organizationId !== 'string') {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Missing required parameter: organizationId',
      });
    }

    // Check if user has access to this organization
    const userOrg = user.organizations.find(
      org => org.organizationId === organizationId
    );

    if (!userOrg) {
      return res.status(403).json({
        error: 'ACCESS_DENIED',
        message: 'You do not have access to this organization',
      });
    }

    // Check viewFinancialDetails permission
    const viewFinancialDetails = userOrg.permissions?.perm_ViewFinancials === true;

    // Build query filters
    const whereClause: any = {
      organizationId,
    };

    if (category) {
      const categories = Array.isArray(category) ? category : [category];
      whereClause.category = { in: categories };
    }

    // Fetch PFA records
    const records = await prisma.pfa_records.findMany({
      where: whereClause,
      take: Math.min(parseInt(limit as string), 500),
      skip: parseInt(offset as string),
      orderBy: { updatedAt: 'desc' },
    });

    // Get total count for pagination
    const totalCount = await prisma.pfa_records.count({
      where: whereClause,
    });

    // Transform records for masking service
    // Calculate cost based on source type (Rental uses monthlyRate * duration, Purchase uses purchasePrice)
    const recordsForMasking = records.map((r): PfaRecordForMasking => {
      // Calculate duration in days for rental cost calculation
      const startDate = r.forecastStart || r.originalStart;
      const endDate = r.forecastEnd || r.originalEnd;
      const durationDays = startDate && endDate
        ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
        : 30; // Default to 30 days if no dates

      // Calculate cost based on source type
      let cost = 0;
      if (r.source === 'Rental' && r.monthlyRate) {
        cost = (durationDays / 30.44) * r.monthlyRate;
      } else if (r.source === 'Purchase' && r.purchasePrice) {
        cost = r.purchasePrice;
      } else if (r.monthlyRate) {
        cost = (durationDays / 30.44) * r.monthlyRate;
      } else if (r.purchasePrice) {
        cost = r.purchasePrice;
      }

      return {
        id: r.id,
        description: r.manufacturer && r.model ? `${r.manufacturer} ${r.model}` : r.manufacturer || r.model || r.category || 'Equipment',
        category: r.category,
        class: r.class,
        source: (r.source || 'Rental') as 'Rental' | 'Purchase',
        cost,
        monthlyRate: r.monthlyRate || undefined,
        purchasePrice: r.purchasePrice || undefined,
        duration: durationDays,
        forecastStart: r.forecastStart,
        forecastEnd: r.forecastEnd,
        actualStart: r.actualStart,
        actualEnd: r.actualEnd,
        isActualized: r.isActualized,
        // Keep other fields for reference
        originalStart: r.originalStart,
        originalEnd: r.originalEnd,
        areaSilo: r.areaSilo,
        dor: r.dor,
        equipment: r.equipment,
        contract: r.contract,
        syncState: r.syncState,
      };
    });

    // Apply financial masking
    const result = await financialMaskingService.translateFinancialData({
      userId: user.userId,
      organizationId,
      records: recordsForMasking,
      viewFinancialDetails,
    });

    logger.info('Financial masking applied', {
      userId: user.userId,
      organizationId,
      recordCount: records.length,
      masked: result.masked,
      viewFinancialDetails,
    });

    return res.status(200).json({
      success: true,
      records: result.records,
      masked: result.masked,
      portfolioInsight: result.portfolioInsight,
      pagination: {
        total: totalCount,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: parseInt(offset as string) + records.length < totalCount,
      },
    });
  } catch (error: unknown) {
      return handleControllerError(error, res, 'FinancialMaskingController.getMaskedPfaRecords');
    }
}

/**
 * GET /api/financial/portfolio-insight
 *
 * Get portfolio-level budget impact insights without exposing actual costs.
 * Available to all users with organization access.
 *
 * Query params:
 * - organizationId: string (required)
 * - category?: string (optional filter by category)
 */
export async function getPortfolioInsight(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const { organizationId, category } = req.query;

    if (!organizationId || typeof organizationId !== 'string') {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Missing required parameter: organizationId',
      });
    }

    // Check if user has access to this organization
    const userOrg = user.organizations.find(
      org => org.organizationId === organizationId
    );

    if (!userOrg) {
      return res.status(403).json({
        error: 'ACCESS_DENIED',
        message: 'You do not have access to this organization',
      });
    }

    // Build query filters
    const whereClause: any = {
      organizationId,
    };

    if (category && typeof category === 'string') {
      whereClause.category = category;
    }

    // Fetch PFA records for insight calculation
    const records = await prisma.pfa_records.findMany({
      where: whereClause,
      select: {
        id: true,
        category: true,
        source: true,
        monthlyRate: true,
        purchasePrice: true,
        forecastStart: true,
        forecastEnd: true,
        originalStart: true,
        originalEnd: true,
      },
    });

    // Transform for portfolio insight (minimal data needed)
    const recordsForInsight = records.map((r): PfaRecordForMasking => {
      // Calculate duration in days for rental cost calculation
      const startDate = r.forecastStart || r.originalStart;
      const endDate = r.forecastEnd || r.originalEnd;
      const durationDays = startDate && endDate
        ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
        : 30;

      // Calculate cost based on source type
      let cost = 0;
      if (r.source === 'Rental' && r.monthlyRate) {
        cost = (durationDays / 30.44) * r.monthlyRate;
      } else if (r.source === 'Purchase' && r.purchasePrice) {
        cost = r.purchasePrice;
      } else if (r.monthlyRate) {
        cost = (durationDays / 30.44) * r.monthlyRate;
      } else if (r.purchasePrice) {
        cost = r.purchasePrice;
      }

      return {
        id: r.id,
        description: '',
        category: r.category,
        source: (r.source || 'Rental') as 'Rental' | 'Purchase',
        cost,
      };
    });

    // Get portfolio insight (always masked = false context to get real percentiles)
    const result = await financialMaskingService.translateFinancialData({
      userId: user.userId,
      organizationId,
      records: recordsForInsight,
      viewFinancialDetails: false, // Force masking to get relative indicators
    });

    return res.status(200).json({
      success: true,
      insight: result.portfolioInsight,
      totalRecords: records.length,
    });
  } catch (error: unknown) {
      return handleControllerError(error, res, 'FinancialMaskingController.getPortfolioInsight');
    }
}

/**
 * POST /api/financial/validate-access
 *
 * Validate if user has financial data access and log bypass attempts.
 * Used for client-side permission checks and security audit logging.
 *
 * Body:
 * - organizationId: string
 * - action: 'view' | 'export'
 */
export async function validateFinancialAccess(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const { organizationId, action } = req.body;

    if (!organizationId || !action) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: organizationId, action',
      });
    }

    // Check if user has access to this organization
    const userOrg = user.organizations.find(
      org => org.organizationId === organizationId
    );

    if (!userOrg) {
      // Log potential bypass attempt
      await prisma.audit_logs.create({
        data: {
          id: uuidv4(),
          userId: user.userId,
          organizationId,
          action: 'financial_access_attempt',
          resource: 'PfaRecord',
          method: 'POST',
          metadata: {
            attemptedAction: action,
            hasOrgAccess: false,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          },
          success: false,
          errorMessage: 'User does not have access to organization',
        },
      });

      return res.status(403).json({
        error: 'ACCESS_DENIED',
        message: 'You do not have access to this organization',
        hasAccess: false,
        viewFinancialDetails: false,
      });
    }

    const viewFinancialDetails = userOrg.permissions?.perm_ViewFinancials === true;

    // Log the access check (for audit trail)
    if (!viewFinancialDetails && action === 'export') {
      // This is a bypass attempt - log it
      await prisma.audit_logs.create({
        data: {
          id: uuidv4(),
          userId: user.userId,
          organizationId,
          action: 'financial_export_attempt',
          resource: 'PfaRecord',
          method: 'POST',
          metadata: {
            attemptedAction: action,
            hasOrgAccess: true,
            hasFinancialAccess: false,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          },
          success: false,
          errorMessage: 'User attempted to export financial data without permission',
        },
      });

      logger.warn('Financial export bypass attempt detected', {
        userId: user.userId,
        organizationId,
        ip: req.ip,
      });
    }

    return res.status(200).json({
      success: true,
      hasAccess: true,
      viewFinancialDetails,
      canExport: viewFinancialDetails && userOrg.permissions?.perm_Export === true,
    });
  } catch (error: unknown) {
      return handleControllerError(error, res, 'FinancialMaskingController.validateFinancialAccess');
    }
}

/**
 * GET /api/financial/cache-stats (Admin only)
 *
 * Get financial masking cache statistics.
 */
export async function getCacheStats(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    // Check if user is admin
    const isAdmin = user.organizations.some(
      org => org.role === 'admin' || org.permissions?.perm_ManageSettings
    );

    if (!isAdmin) {
      return res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'Admin permission required',
      });
    }

    const stats = financialMaskingService.getCacheStats();

    return res.status(200).json({
      success: true,
      cache: stats,
    });
  } catch (error: unknown) {
      return handleControllerError(error, res, 'FinancialMaskingController.getCacheStats');
    }
}

/**
 * POST /api/financial/cache/clear (Admin only)
 *
 * Clear the financial masking cache.
 */
export async function clearCache(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    // Check if user is admin
    const isAdmin = user.organizations.some(
      org => org.role === 'admin' || org.permissions?.perm_ManageSettings
    );

    if (!isAdmin) {
      return res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'Admin permission required',
      });
    }

    financialMaskingService.clearCache();

    logger.info('Financial masking cache cleared', {
      clearedBy: user.userId,
    });

    return res.status(200).json({
      success: true,
      message: 'Cache cleared successfully',
    });
  } catch (error: unknown) {
      return handleControllerError(error, res, 'FinancialMaskingController.clearCache');
    }
}

/**
 * POST /api/financial/mask
 *
 * Mask financial data in provided PFA records.
 * This endpoint accepts records in the request body (for client-side masking).
 *
 * Body:
 * - records: PfaRecord[] (array of records with cost data)
 * - viewFinancialDetails: boolean (user's capability)
 *
 * Response:
 * {
 *   success: true,
 *   maskedRecords: MaskedPfaRecord[],
 *   portfolioInsight: PortfolioInsight
 * }
 */
export async function maskFinancialData(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const { records, viewFinancialDetails } = req.body;

    // Validation
    if (!Array.isArray(records)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'records must be an array',
      });
    }

    if (typeof viewFinancialDetails !== 'boolean') {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'viewFinancialDetails must be a boolean',
      });
    }

    // Extract organizationId from user context (not from request body)
    const organizationId = user.organizations[0]?.organizationId;

    if (!organizationId) {
      return res.status(403).json({
        error: 'ACCESS_DENIED',
        message: 'No organization access',
      });
    }

    // Transform records to match FinancialMaskingService format
    const recordsForMasking = records.map((r: any) => {
      // Calculate duration in days if not provided
      const duration = r.duration || (
        r.forecastStart && r.forecastEnd
          ? Math.ceil((new Date(r.forecastEnd).getTime() - new Date(r.forecastStart).getTime()) / (1000 * 60 * 60 * 24))
          : 30
      );

      // Calculate cost if not provided
      let cost = r.cost || 0;
      if (!cost && r.source === 'Rental' && r.monthlyRate) {
        cost = (duration / 30.44) * r.monthlyRate;
      } else if (!cost && r.source === 'Purchase' && r.purchasePrice) {
        cost = r.purchasePrice;
      }

      return {
        id: r.id,
        description: r.description || r.manufacturer || r.model || r.category || 'Equipment',
        category: r.category,
        class: r.class,
        source: (r.source || 'Rental') as 'Rental' | 'Purchase',
        cost,
        monthlyRate: r.monthlyRate,
        purchasePrice: r.purchasePrice,
        duration,
        forecastStart: r.forecastStart,
        forecastEnd: r.forecastEnd,
        actualStart: r.actualStart,
        actualEnd: r.actualEnd,
        isActualized: r.isActualized,
      };
    });

    // Apply financial masking
    const result = await financialMaskingService.translateFinancialData({
      userId: user.userId,
      organizationId,
      records: recordsForMasking,
      viewFinancialDetails,
    });

    logger.info('Financial masking applied (client-side request)', {
      userId: user.userId,
      organizationId,
      recordCount: records.length,
      masked: result.masked,
      viewFinancialDetails,
    });

    return res.status(200).json({
      success: true,
      maskedRecords: result.records,
      portfolioInsight: result.portfolioInsight,
    });
  } catch (error: unknown) {
      return handleControllerError(error, res, 'FinancialMaskingController.maskFinancialData');
    }
}
