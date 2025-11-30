/**
 * Audit Controller
 * Phase 5, Task 5.4 - Pre-Flight Transaction Ceremony
 *
 * Handles audit logging for:
 * - Pre-flight reviews (mandatory bulk operation reviews)
 * - Pre-flight bypasses (users with bypassReview capability)
 * - High-risk operation tracking
 */

import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';

/**
 * Log pre-flight review
 * POST /api/audit/pre-flight-review
 */
export const logPreFlightReview = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      operationType,
      description,
      affectedRecordCount,
      organizations,
      categories,
      changes,
      estimatedImpact,
      comment,
      confirmed,
      bypassedBy,
    } = req.body;

    const userId = (req as any).user?.userId;
    const username = (req as any).user?.username;
    const organizationId = req.body.organizationId || (req as any).user?.organizationId;

    if (!operationType || !affectedRecordCount) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'operationType and affectedRecordCount are required',
      });
    }

    // Validate comment for non-bypass operations
    if (!bypassedBy && (!comment || comment.trim().length < 10)) {
      return res.status(400).json({
        error: 'Invalid comment',
        message: 'Comment must be at least 10 characters for non-bypass operations',
      });
    }

    // Create audit log entry
    const auditLog = await prisma.audit_logs.create({
      data: {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        organizationId,
        action: bypassedBy ? 'pre_flight_bypassed' : 'pre_flight_review',
        resource: 'bulk_operations',
        method: 'POST',
        success: true,
        metadata: {
          operationType,
          description,
          affectedRecordCount,
          organizations: organizations || [],
          categories: categories || [],
          changes: changes || [],
          estimatedImpact: estimatedImpact || {},
          comment: comment || 'Bypassed by admin',
          confirmed: confirmed !== undefined ? confirmed : true,
          bypassedBy,
          reviewedBy: username,
          timestamp: new Date().toISOString(),
        },
      },
    });

    logger.info(
      `Pre-flight ${bypassedBy ? 'bypassed' : 'review logged'}: ${operationType} by ${username}`,
      {
        auditLogId: auditLog.id,
        affectedRecordCount,
        bypassedBy,
      }
    );

    return res.status(201).json({
      success: true,
      message: 'Pre-flight review logged successfully',
      audit_log: {
        id: auditLog.id,
        action: auditLog.action,
        timestamp: auditLog.timestamp,
      },
    });
  } catch (error) {
    logger.error('Error logging pre-flight review:', error);
    return res.status(500).json({ error: 'Failed to log pre-flight review' });
  }
};

/**
 * Get pre-flight review history
 * GET /api/audit/pre-flight-reviews
 */
export const getPreFlightReviews = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { organizationId, userId, limit = 50, offset = 0 } = req.query;

    const where: any = {
      action: { in: ['pre_flight_review', 'pre_flight_bypassed'] },
    };

    if (organizationId) {
      where.organizationId = organizationId as string;
    }

    if (userId) {
      where.userId = userId as string;
    }

    const reviews = await prisma.audit_logs.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    const total = await prisma.audit_logs.count({ where });

    return res.json({
      reviews,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + reviews.length < total,
      },
    });
  } catch (error) {
    logger.error('Error fetching pre-flight reviews:', error);
    return res.status(500).json({ error: 'Failed to fetch pre-flight reviews' });
  }
};

/**
 * Get pre-flight statistics
 * GET /api/audit/pre-flight-stats
 */
export const getPreFlightStats = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { organizationId, startDate, endDate } = req.query;

    const where: any = {
      action: { in: ['pre_flight_review', 'pre_flight_bypassed'] },
    };

    if (organizationId) {
      where.organizationId = organizationId as string;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate as string);
      }
    }

    const reviews = await prisma.audit_logs.findMany({
      where,
      select: {
        action: true,
        metadata: true,
      },
    });

    const stats = {
      totalReviews: reviews.filter((r) => r.action === 'pre_flight_review').length,
      totalBypasses: reviews.filter((r) => r.action === 'pre_flight_bypassed').length,
      totalAffectedRecords: reviews.reduce((sum, r) => {
        const metadata = r.metadata as any;
        return sum + (metadata?.affectedRecordCount || 0);
      }, 0),
      operationTypes: reviews.reduce((acc: Record<string, number>, r) => {
        const metadata = r.metadata as any;
        const type = metadata?.operationType || 'unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {}),
      bypassRate:
        reviews.length > 0
          ? (reviews.filter((r) => r.action === 'pre_flight_bypassed').length / reviews.length) *
            100
          : 0,
    };

    return res.json({ stats });
  } catch (error) {
    logger.error('Error fetching pre-flight stats:', error);
    return res.status(500).json({ error: 'Failed to fetch pre-flight stats' });
  }
};

/**
 * Get audit logs
 * GET /api/audit/logs
 */
export const getAuditLogs = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { organizationId, userId, action, limit = 100, offset = 0, orderBy = 'timestamp_desc' } = req.query;

    const where: any = {};

    if (organizationId) {
      where.organizationId = organizationId as string;
    }

    if (userId) {
      where.userId = userId as string;
    }

    if (action) {
      where.action = action as string;
    }

    const logs = await prisma.audit_logs.findMany({
      where,
      orderBy: orderBy === 'timestamp_desc' ? { timestamp: 'desc' } : { timestamp: 'asc' },
      take: Number(limit),
      skip: Number(offset),
    });

    const total = await prisma.audit_logs.count({ where });

    return res.json({
      logs,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + logs.length < total,
      },
    });
  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    return res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};

/**
 * Get revert preview
 * GET /api/audit/revert/:transactionId/preview
 */
export const getRevertPreview = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { transactionId } = req.params;

    // Get the transaction
    const transaction = await prisma.audit_logs.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Check 7-day restriction
    const txDate = new Date(transaction.timestamp);
    const now = new Date();
    const daysDiff = (now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > 7) {
      return res.status(400).json({
        error: 'Transaction outside 7-day revert window',
        message: 'Transactions can only be reverted within 7 days',
      });
    }

    // Check if already reverted
    const metadata = transaction.metadata as any;
    if (metadata?.reverted === true) {
      return res.status(400).json({
        error: 'Transaction already reverted',
        message: 'This transaction has already been reverted',
      });
    }

    // Generate preview from transaction metadata
    const changes = metadata?.changes || [];
    const affectedRecordCount = metadata?.affectedRecordCount || metadata?.affectedCount || 0;

    const preview = {
      changes: changes.map((change: any) => ({
        recordId: change.recordId || 'N/A',
        field: change.field || 'Unknown',
        currentValue: change.newValue || change.currentValue || 'N/A',
        revertValue: change.oldValue || change.revertValue || 'N/A',
      })),
      affectedRecordCount,
      estimatedImpact: metadata?.estimatedImpact || {},
    };

    return res.json(preview);
  } catch (error) {
    logger.error('Error fetching revert preview:', error);
    return res.status(500).json({ error: 'Failed to fetch revert preview' });
  }
};

/**
 * Revert transaction
 * POST /api/audit/revert/:transactionId
 */
export const revertTransaction = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { transactionId } = req.params;
    const { comment, organizationId } = req.body;

    const userId = (req as any).user?.userId;
    const username = (req as any).user?.username;

    if (!comment || comment.trim().length < 10) {
      return res.status(400).json({
        error: 'Invalid comment',
        message: 'Comment must be at least 10 characters',
      });
    }

    // Get the transaction
    const transaction = await prisma.audit_logs.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Check 7-day restriction
    const txDate = new Date(transaction.timestamp);
    const now = new Date();
    const daysDiff = (now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > 7) {
      return res.status(400).json({
        error: 'Transaction outside 7-day revert window',
        message: 'Transactions can only be reverted within 7 days',
      });
    }

    // Check if already reverted
    const metadata = transaction.metadata as any;
    if (metadata?.reverted === true) {
      return res.status(400).json({
        error: 'Transaction already reverted',
        message: 'This transaction has already been reverted',
      });
    }

    // Check if transaction is revertible
    const revertibleActions = [
      'pfa:bulk_update',
      'pfa:bulk_shift_time',
      'pfa:bulk_adjust_duration',
      'pfa:bulk_change_category',
      'pfa:bulk_change_dor',
      'pre_flight_review',
    ];

    if (!revertibleActions.includes(transaction.action)) {
      return res.status(400).json({
        error: 'Transaction not revertible',
        message: 'This type of transaction cannot be reverted',
      });
    }

    // Mark original transaction as reverted
    await prisma.audit_logs.update({
      where: { id: transactionId },
      data: {
        metadata: {
          ...metadata,
          reverted: true,
          revertedBy: userId,
          revertedAt: new Date().toISOString(),
          revertComment: comment,
        },
      },
    });

    // Create revert audit log entry
    const revertLog = await prisma.audit_logs.create({
      data: {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        organizationId: transaction.organizationId || organizationId,
        action: 'time_travel_revert',
        resource: 'transactions',
        method: 'POST',
        success: true,
        metadata: {
          revertedTransactionId: transactionId,
          originalAction: transaction.action,
          originalTimestamp: transaction.timestamp,
          originalUserId: transaction.userId,
          affectedRecordCount: metadata?.affectedRecordCount || metadata?.affectedCount || 0,
          comment,
          revertedBy: username,
          timestamp: new Date().toISOString(),
        },
      },
    });

    logger.info(`Transaction reverted: ${transactionId} by ${username}`, {
      revertLogId: revertLog.id,
      originalAction: transaction.action,
    });

    return res.status(200).json({
      success: true,
      message: 'Transaction reverted successfully',
      revertLog: {
        id: revertLog.id,
        timestamp: revertLog.timestamp,
      },
    });
  } catch (error) {
    logger.error('Error reverting transaction:', error);
    return res.status(500).json({ error: 'Failed to revert transaction' });
  }
};

// ============================================================================
// Semantic Audit Search (Phase 7, Task 7.3)
// ============================================================================

import { semanticAuditSearchService } from '../services/ai/SemanticAuditSearchService';

/**
 * Semantic audit search using natural language
 * POST /api/audit/semantic-search
 *
 * Translates natural language queries into database filters.
 * Supports multi-turn queries with context preservation.
 *
 * Request body:
 * - query: string (natural language query)
 * - contextId?: string (previous query ID for multi-turn)
 *
 * Response:
 * - queryId: string (for multi-turn follow-up)
 * - parsedQuery: object (interpreted filters)
 * - naturalLanguageSummary: string
 * - audit_logs: array
 * - relatedEvents: array (external correlations)
 * - aiInsight: string
 * - confidence: number (0-1)
 * - clarificationNeeded: boolean
 * - suggestions?: string[] (if query is ambiguous)
 */
export const semanticSearch = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { query, contextId } = req.body;
    const userId = (req as any).user?.userId;
    const organizationId = req.body.organizationId || (req as any).user?.organizationId;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Missing required field: query',
      });
    }

    if (query.length > 500) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Query exceeds maximum length of 500 characters',
      });
    }

    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const result = await semanticAuditSearchService.semanticSearch({
      query,
      userId,
      organizationId,
      contextId,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Semantic search error:', error);
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to process semantic search',
    });
  }
};

/**
 * Get semantic search cache statistics (admin only)
 * GET /api/audit/semantic-search/cache-stats
 */
export const getSemanticSearchCacheStats = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const stats = semanticAuditSearchService.getCacheStats();
    return res.json({ success: true, cache: stats });
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    return res.status(500).json({ error: 'Failed to get cache stats' });
  }
};

/**
 * Clear semantic search cache (admin only)
 * POST /api/audit/semantic-search/clear-cache
 */
export const clearSemanticSearchCache = async (req: Request, res: Response): Promise<Response> => {
  try {
    semanticAuditSearchService.clearCache();
    logger.info('Semantic search cache cleared', { clearedBy: (req as any).user?.userId });
    return res.json({ success: true, message: 'Cache cleared successfully' });
  } catch (error) {
    logger.error('Error clearing cache:', error);
    return res.status(500).json({ error: 'Failed to clear cache' });
  }
};
