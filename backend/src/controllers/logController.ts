import { Request, Response } from 'express';
import prisma from '../config/database';

/**
 * Get AI usage logs (with optional filtering)
 */
export const getAiUsageLogs = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { organizationId, userId, limit = '100' } = req.query;

    const where: any = {};
    if (organizationId) where.organizationId = organizationId as string;
    if (userId) where.userId = userId as string;

    const logs = await prisma.ai_usage_logs.findMany({
      where,
      include: {
        users: {
          select: {
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
    });

    return res.json({ logs });
  } catch (error) {
    console.error('Error fetching AI usage logs:', error);
    return res.status(500).json({ error: 'Failed to fetch AI usage logs' });
  }
};

/**
 * Get sync logs (with optional filtering)
 */
export const getSyncLogs = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { organizationId, limit = '100' } = req.query;

    const where: any = {};
    if (organizationId) where.organizationId = organizationId as string;

    const logs = await prisma.sync_logs.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
    });

    return res.json({ logs });
  } catch (error) {
    console.error('Error fetching sync logs:', error);
    return res.status(500).json({ error: 'Failed to fetch sync logs' });
  }
};

/**
 * Get AI usage statistics summary
 */
export const getAiUsageStats = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { organizationId } = req.query;

    const where: any = {};
    if (organizationId) where.organizationId = organizationId as string;

    // Total usage
    const totalLogs = await prisma.ai_usage_logs.count({ where });

    // Aggregate statistics
    const stats = await prisma.ai_usage_logs.aggregate({
      where,
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        costUsd: true,
      },
      _avg: {
        latencyMs: true,
      },
    });

    // Success rate
    const successCount = await prisma.ai_usage_logs.count({
      where: { ...where, success: true },
    });

    return res.json({
      totalRequests: totalLogs,
      totalTokens: stats._sum.totalTokens || 0,
      totalCost: stats._sum.costUsd || 0,
      averageLatency: Math.round(stats._avg.latencyMs || 0),
      successRate: totalLogs > 0 ? (successCount / totalLogs) * 100 : 0,
    });
  } catch (error) {
    console.error('Error fetching AI usage stats:', error);
    return res.status(500).json({ error: 'Failed to fetch AI usage statistics' });
  }
};

/**
 * Get sync statistics summary
 */
export const getSyncStats = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { organizationId } = req.query;

    const where: any = {};
    if (organizationId) where.organizationId = organizationId as string;

    // Total syncs
    const totalSyncs = await prisma.sync_logs.count({ where });

    // Success syncs
    const successCount = await prisma.sync_logs.count({
      where: { ...where, status: 'success' },
    });

    // Aggregate statistics
    const stats = await prisma.sync_logs.aggregate({
      where,
      _sum: {
        recordsProcessed: true,
        recordsInserted: true,
        recordsUpdated: true,
        recordsDeleted: true,
      },
      _avg: {
        durationMs: true,
      },
    });

    return res.json({
      totalSyncs,
      successfulSyncs: successCount,
      successRate: totalSyncs > 0 ? (successCount / totalSyncs) * 100 : 0,
      totalRecordsProcessed: stats._sum.recordsProcessed || 0,
      totalRecordsInserted: stats._sum.recordsInserted || 0,
      totalRecordsUpdated: stats._sum.recordsUpdated || 0,
      totalRecordsDeleted: stats._sum.recordsDeleted || 0,
      averageDuration: Math.round(stats._avg.durationMs || 0),
    });
  } catch (error) {
    console.error('Error fetching sync stats:', error);
    return res.status(500).json({ error: 'Failed to fetch sync statistics' });
  }
};
