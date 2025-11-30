// backend/src/controllers/aiNLPermissionController.ts
/**
 * AI Natural Language Permission Query Controller
 *
 * Phase 6, Task 6.4 of ADR-005 Multi-Tenant Access Control
 *
 * Handles API endpoints for natural language permission queries.
 */

import { Request, Response } from 'express';
import nlPermissionService from '../services/ai/NaturalLanguagePermissionService';
import { logger } from '../utils/logger';
import { handleControllerError } from '../utils/errorHandling';

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

/**
 * POST /api/ai/nl-query
 *
 * Process a natural language permission query
 *
 * Request Body:
 * {
 *   "query": "Who can delete records in HOLNG?",
 *   "organizationId": "optional-org-id"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "queryType": "capability_search",
 *   "response": "Found 5 users with delete capability...",
 *   "data": { ... },
 *   "structuredAnswer": { ... },
 *   "suggestedFollowUps": ["...", "..."]
 * }
 */
export async function processNaturalLanguageQuery(req: AuthenticatedRequest, res: Response) {
  try {
    const { query, organizationId } = req.body;
    const requestingUser = req.user;

    if (!requestingUser) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'query is required and must be a non-empty string',
      });
    }

    // Only users with ManageUsers permission can query about all users
    const canQueryAll = requestingUser.organizations.some(
      org => org.role === 'admin' || org.permissions?.perm_ManageUsers
    );

    // For non-admins, restrict to their own organizations
    const effectiveOrgId = canQueryAll
      ? organizationId
      : requestingUser.organizations[0]?.organizationId;

    const result = await nlPermissionService.processQuery({
      query: query.trim(),
      organizationId: effectiveOrgId,
      userId: requestingUser.userId,
    });

    logger.info('Natural language permission query processed', {
      userId: requestingUser.userId,
      queryType: result.queryType,
      success: result.success,
    });

    res.json(result);
  } catch (error: unknown) {
      return handleControllerError(error, res, 'AiNLPermissionController.unknown');
    }
}

/**
 * GET /api/ai/nl-query/suggestions
 *
 * Get suggested queries based on context
 */
export async function getQuerySuggestions(req: AuthenticatedRequest, res: Response) {
  try {
    const requestingUser = req.user;

    if (!requestingUser) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    // Return context-aware suggestions
    const suggestions = [
      {
        category: 'User Lookup',
        queries: [
          'What can [username] do?',
          'Show me [username]\'s permissions',
          'What access does [username] have?',
        ],
      },
      {
        category: 'Organization',
        queries: [
          'Who has access to [organization]?',
          'List users in [organization] with admin rights',
          'Who can delete records in [organization]?',
        ],
      },
      {
        category: 'Capability Search',
        queries: [
          'Who can delete records?',
          'Show me users with financial access',
          'Who has export permissions?',
          'List users who can manage other users',
        ],
      },
      {
        category: 'Cross-Organization',
        queries: [
          'Who has access to multiple organizations?',
          'Show me users with admin access in more than one org',
          'Which users have financial access across all organizations?',
        ],
      },
      {
        category: 'Security Analysis',
        queries: [
          'Who has the most permissions?',
          'Show me users with high-risk permissions',
          'List recently granted admin access',
        ],
      },
    ];

    res.json({ suggestions });
  } catch (error: unknown) {
      return handleControllerError(error, res, 'AiNLPermissionController.unknown');
    }
}

/**
 * GET /api/ai/nl-query/history
 *
 * Get user's recent permission query history
 */
export async function getQueryHistory(req: AuthenticatedRequest, res: Response) {
  try {
    const requestingUser = req.user;

    if (!requestingUser) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const { limit = 10 } = req.query;

    // Get recent queries from audit log
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const recentQueries = await prisma.audit_logs.findMany({
      where: {
        userId: requestingUser.userId,
        action: 'nl_permission_query',
      },
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit as string),
      select: {
        metadata: true,
        timestamp: true,
      },
    });

    const history = recentQueries.map((log: any) => ({
      query: log.metadata?.query,
      queryType: log.metadata?.queryType,
      resultCount: log.metadata?.resultCount,
      timestamp: log.timestamp,
    }));

    res.json({ history });
  } catch (error: unknown) {
      return handleControllerError(error, res, 'AiNLPermissionController.unknown');
    }
}
