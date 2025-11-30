/**
 * BEO Controller
 *
 * Endpoints for:
 * 1. Glass Mode: Portfolio health monitoring and priority items
 * 2. Boardroom Voice Analyst: Natural language portfolio queries (UC-21)
 *
 * Phase 8, Task 8.1 of ADR-005 Multi-Tenant Access Control
 */

import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { BeoAnalyticsService } from '../services/ai/BeoAnalyticsService';
import { ArbitrageDetectorService } from '../services/ai/ArbitrageDetectorService';

// Instantiate BEO Analytics Service
const beoService = new BeoAnalyticsService();

// ============================================================================
// GLASS MODE ENDPOINTS
// ============================================================================

/**
 * GET /api/beo/portfolio-health
 * Get portfolio-wide health metrics across all organizations
 */
export async function getPortfolioHealth(_req: AuthRequest, res: Response) {
  try {
    logger.info('GET /api/beo/portfolio-health');

    // Get all active organizations
    const organizations = await prisma.organizations.findMany({
      where: {
        isActive: true,
      },
      include: {
        user_organizations: {
          where: {
            users: {
              isActive: true,
            },
          },
          select: {
            userId: true,
          },
        },
      },
    });

    // Calculate metrics for each organization
    const orgMetrics = await Promise.all(
      organizations.map(async (org: any) => {
        // Get PFA records count (placeholder - would come from PFA tables when available)
        const recordCount = 0;

        // Calculate health score based on service status and activity
        const baseScore = org.serviceStatus === 'active' ? 85 : 50;
        const healthScore = baseScore + Math.floor(Math.random() * 15); // Mock variation

        // Mock financial data (would come from PFA records)
        const budgetTotal = 1000000 + Math.floor(Math.random() * 5000000);
        const actualTotal = budgetTotal * (0.8 + Math.random() * 0.3);
        const variance = actualTotal - budgetTotal;

        return {
          id: org.id,
          code: org.code,
          name: org.name,
          healthScore,
          status: org.serviceStatus,
          serviceStatus: org.serviceStatus === 'active' ? 'operational' as const : 'degraded' as const,
          budgetTotal,
          actualTotal,
          variance,
          activeUsers: org.user_organizations.length,
          lastSyncAt: org.updatedAt.toISOString(),
          syncStatus: 'success' as const,
          recordCount,
        };
      })
    );

    // Calculate portfolio-wide totals
    const totalBudget = orgMetrics.reduce((sum: number, org: any) => sum + org.budgetTotal, 0);
    const totalActual = orgMetrics.reduce((sum: number, org: any) => sum + org.actualTotal, 0);
    const totalVariance = totalActual - totalBudget;
    const avgHealthScore = Math.round(orgMetrics.reduce((sum: number, org: any) => sum + org.healthScore, 0) / orgMetrics.length);
    const activeUsers = orgMetrics.reduce((sum: number, org: any) => sum + org.activeUsers, 0);

    const response = {
      totalOrganizations: organizations.length,
      activeOrganizations: organizations.filter((o: any) => o.serviceStatus === 'active').length,
      healthScore: avgHealthScore,
      previousHealthScore: avgHealthScore - Math.floor(Math.random() * 10), // Mock trend
      totalBudget,
      totalActual,
      totalVariance,
      activeUsers,
      organizations: orgMetrics,
      trends: {
        organizations: 2, // Mock: 2 new orgs this month
        healthScore: 3, // Mock: +3 points this month
        variance: -50000, // Mock: improved by 50K
        users: 5, // Mock: 5 new users
      },
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching portfolio health:', error);
    res.status(500).json({
      error: 'Failed to fetch portfolio health',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/beo/priority-items
 * Get priority items and alerts across all organizations
 */
export async function getPriorityItems(_req: AuthRequest, res: Response) {
  try {
    logger.info('GET /api/beo/priority-items');

    // Get all active organizations for context
    const organizations = await prisma.organizations.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        serviceStatus: true,
      },
    });

    // Generate mock priority items (would come from actual monitoring system)
    const items: Array<{
      id: string;
      organizationId: string;
      organizationCode: string;
      organizationName: string;
      severity: 'critical' | 'high' | 'medium';
      category: 'budget' | 'schedule' | 'data_quality' | 'sync' | 'activity';
      title: string;
      description: string;
      impactValue: string;
      impactLabel: string;
      affectedRecords: number;
      detectedAt: string;
      metadata?: Record<string, any>;
    }> = [];

    // Check for organizations with issues
    organizations.forEach((org: any, index: number) => {
      // Mock: Budget overrun alert
      if (index % 3 === 0) {
        items.push({
          id: `budget-${org.id}`,
          organizationId: org.id,
          organizationCode: org.code,
          organizationName: org.name,
          severity: 'high',
          category: 'budget',
          title: 'Budget Variance Exceeds Threshold',
          description: `Actual costs are 15% over budget for this organization`,
          impactValue: '+$250K',
          impactLabel: 'Over Budget',
          affectedRecords: 145,
          detectedAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
          metadata: {
            variancePercent: 15,
            affectedCategories: ['Equipment', 'Labor'],
          },
        });
      }

      // Mock: Sync failure alert
      if (index % 4 === 0) {
        items.push({
          id: `sync-${org.id}`,
          organizationId: org.id,
          organizationCode: org.code,
          organizationName: org.name,
          severity: 'critical',
          category: 'sync',
          title: 'PEMS Sync Failed',
          description: `Data synchronization has failed for the last 3 attempts`,
          impactValue: '72h',
          impactLabel: 'Data Staleness',
          affectedRecords: 0,
          detectedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
          metadata: {
            lastSuccessfulSync: new Date(Date.now() - 72 * 3600000).toISOString(),
            errorCode: 'ECONNREFUSED',
          },
        });
      }

      // Mock: Data quality issue
      if (index % 5 === 0) {
        items.push({
          id: `quality-${org.id}`,
          organizationId: org.id,
          organizationCode: org.code,
          organizationName: org.name,
          severity: 'medium',
          category: 'data_quality',
          title: 'Missing Critical Fields',
          description: `Multiple records are missing required cost data`,
          impactValue: '23 records',
          impactLabel: 'Incomplete Data',
          affectedRecords: 23,
          detectedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
          metadata: {
            missingFields: ['monthlyRate', 'purchasePrice'],
          },
        });
      }
    });

    // Sort by severity and date
    const severityOrder = { critical: 0, high: 1, medium: 2 };
    items.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
    });

    // Calculate summary
    const summary = {
      critical: items.filter(i => i.severity === 'critical').length,
      high: items.filter(i => i.severity === 'high').length,
      medium: items.filter(i => i.severity === 'medium').length,
      total: items.length,
    };

    res.json({
      items,
      summary,
    });
  } catch (error) {
    logger.error('Error fetching priority items:', error);
    res.status(500).json({
      error: 'Failed to fetch priority items',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================================================
// BOARDROOM VOICE ANALYST ENDPOINTS (UC-21)
// ============================================================================

/**
 * POST /api/beo/query
 *
 * Answer natural language portfolio queries with voice-optimized responses
 *
 * Request Body:
 * {
 *   "query": string,              // e.g., "Which projects are over budget?"
 *   "responseFormat": "conversational" | "structured",
 *   "contextQueryId"?: string      // Optional queryId for follow-up questions
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "queryId": string,
 *   "response": string,            // Main narrative response
 *   "voiceResponse": string,       // TTS-optimized (<500 chars)
 *   "confidence": number,          // 0-1
 *   "queryType": string,           // budget_variance, equipment_status, etc.
 *   "data": any,                   // Structured data (if responseFormat=structured)
 *   "metadata": {
 *     "organizationsAnalyzed": number,
 *     "recordsAnalyzed": number,
 *     "userPersona": string,
 *     "modelUsed": string,
 *     "latencyMs": number,
 *     "cached": boolean
 *   }
 * }
 */
export async function handlePortfolioQuery(req: AuthRequest, res: Response): Promise<void> {
  try {
    // 1. Authentication check
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      return;
    }

    // 2. Authorization check: Require perm_ViewAllOrgs capability (BEO access)
    const hasPortfolioAccess = req.user.organizations.some(
      org => {
        const capabilities = (org as any).capabilities || {};
        return capabilities['perm_ViewAllOrgs'] === true;
      }
    );

    if (!hasPortfolioAccess) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'BEO portfolio access required (perm_ViewAllOrgs capability)'
      });
      return;
    }

    // 3. Validate input
    const { query, responseFormat, contextQueryId } = req.body;

    if (!query || typeof query !== 'string') {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'query is required and must be a string'
      });
      return;
    }

    // Prevent abuse: Max 500 chars
    if (query.length > 500) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'query must be 500 characters or less'
      });
      return;
    }

    if (responseFormat && !['conversational', 'structured'].includes(responseFormat)) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'responseFormat must be "conversational" or "structured"'
      });
      return;
    }

    // 4. Call BeoAnalyticsService
    logger.info(`[BEO Query] User ${req.user.userId}: "${query}"`);

    const result = await beoService.answerPortfolioQuery({
      userId: req.user.userId,
      query,
      responseFormat: responseFormat || 'conversational',
      contextQueryId,
    });

    // 5. Return success response
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('[BEO Query] Portfolio query failed:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('AI adapter not available')) {
        res.status(503).json({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: 'AI service is currently unavailable'
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to process portfolio query'
    });
  }
}

/**
 * GET /api/beo/recent-queries
 *
 * Get user's recent portfolio queries for context menu
 *
 * Response:
 * {
 *   "success": true,
 *   "queries": [
 *     {
 *       "queryId": string,
 *       "query": string,
 *       "timestamp": string (ISO 8601)
 *     }
 *   ]
 * }
 */
export async function getRecentQueries(req: AuthRequest, res: Response): Promise<void> {
  try {
    // 1. Authentication check
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      return;
    }

    // 2. Fetch recent queries from database
    const recentQueries = await prisma.ai_query_logs.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        query: true,
        createdAt: true,
      },
    });

    // 3. Format response
    res.status(200).json({
      success: true,
      queries: recentQueries.map((q: any) => ({
        queryId: q.id,
        query: q.query,
        timestamp: q.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    logger.error('[BEO Query] Failed to fetch recent queries:', error);

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve recent queries'
    });
  }
}

// ============================================================================
// NARRATIVE VARIANCE GENERATOR ENDPOINTS (UC-22)
// ============================================================================

import { NarrativeExplainerService } from '../services/ai/NarrativeExplainerService';
const narrativeService = new NarrativeExplainerService();

/**
 * POST /api/beo/narrative/generate
 *
 * Generate AI-powered variance narrative for board meetings
 *
 * Request Body:
 * {
 *   "organizationId": string,
 *   "title"?: string,
 *   "dateRange"?: { "start": string, "end": string }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "narrativeId": string,
 *   "title": string,
 *   "chapters": Chapter[],
 *   "keyTakeaways": string[],
 *   "timeline": TimelineEvent[],
 *   "recommendations": string[],
 *   "estimatedReadTime": number,
 *   "metadata": {...}
 * }
 */
export async function generateNarrative(req: AuthRequest, res: Response): Promise<void> {
  try {
    // 1. Authentication check
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      return;
    }

    // 2. Validate input
    const { organizationId, title, dateRange } = req.body;

    if (!organizationId || typeof organizationId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'organizationId is required and must be a string'
      });
      return;
    }

    // 3. Validate date range if provided
    let parsedDateRange;
    if (dateRange) {
      try {
        parsedDateRange = {
          start: new Date(dateRange.start),
          end: new Date(dateRange.end),
        };
      } catch (error) {
        res.status(400).json({
          success: false,
          error: 'BAD_REQUEST',
          message: 'Invalid date range format'
        });
        return;
      }
    }

    // 4. Generate narrative with service
    logger.info(`[Narrative] User ${req.user.userId} generating narrative for org ${organizationId}`);

    const result = await narrativeService.explainVariance({
      userId: req.user.userId,
      organizationId,
      title,
      dateRange: parsedDateRange,
    });

    // 5. Return success response
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('[Narrative] Failed to generate narrative:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('BEO access required')) {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'BEO portfolio access required (perm_ViewAllOrgs capability)'
        });
        return;
      }

      if (error.message.includes('AI adapter not available')) {
        res.status(503).json({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: 'AI service is currently unavailable'
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to generate narrative'
    });
  }
}

/**
 * GET /api/beo/narrative/:narrativeId
 *
 * Retrieve saved narrative by ID
 *
 * Response:
 * {
 *   "success": true,
 *   "narrative": {...}
 * }
 */
export async function getNarrative(req: AuthRequest, res: Response): Promise<void> {
  try {
    // 1. Authentication check
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      return;
    }

    // 2. Get narrative ID from params
    const { narrativeId } = req.params;

    if (!narrativeId) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'narrativeId is required'
      });
      return;
    }

    // 3. Fetch narrative
    logger.info(`[Narrative] User ${req.user.userId} fetching narrative ${narrativeId}`);

    const narrative = await narrativeService.getNarrative(narrativeId);

    // 4. Return success response
    res.status(200).json({
      success: true,
      narrative,
    });
  } catch (error) {
    logger.error('[Narrative] Failed to fetch narrative:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Narrative not found'
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve narrative'
    });
  }
}

/**
 * POST /api/beo/narrative/:narrativeId/progress
 *
 * Save reading progress for a narrative
 *
 * Request Body:
 * {
 *   "chapter": number
 * }
 *
 * Response:
 * {
 *   "success": true
 * }
 */
export async function saveReadingProgress(req: AuthRequest, res: Response): Promise<void> {
  try {
    // 1. Authentication check
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      return;
    }

    // 2. Validate input
    const { narrativeId } = req.params;
    const { chapter } = req.body;

    if (!narrativeId || typeof narrativeId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'narrativeId is required'
      });
      return;
    }

    if (typeof chapter !== 'number' || chapter < 1 || chapter > 5) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'chapter must be a number between 1 and 5'
      });
      return;
    }

    // 3. Update reading progress
    logger.info(`[Narrative] User ${req.user.userId} at chapter ${chapter} of ${narrativeId}`);

    await narrativeService.updateReadingProgress(narrativeId, req.user.userId, chapter);

    // 4. Return success response
    res.status(200).json({
      success: true,
    });
  } catch (error) {
    logger.error('[Narrative] Failed to save reading progress:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Narrative not found'
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to save reading progress'
    });
  }
}

/**
 * GET /api/beo/narrative/:narrativeId/export-pdf
 *
 * Export narrative as PDF (returns HTML for client-side PDF conversion)
 *
 * Response: HTML document styled for PDF printing
 */
export async function exportNarrativePDF(req: AuthRequest, res: Response): Promise<void> {
  try {
    // 1. Authentication check
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      return;
    }

    // 2. Get narrative ID from params
    const { narrativeId } = req.params;

    if (!narrativeId) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'narrativeId is required'
      });
      return;
    }

    // 3. Fetch narrative
    logger.info(`[Narrative] User ${req.user.userId} exporting narrative ${narrativeId} as PDF`);

    const narrative = await narrativeService.getNarrative(narrativeId);

    if (!narrative) {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Narrative not found'
      });
      return;
    }

    // 4. Generate HTML document for PDF export
    const htmlContent = generateNarrativePdfHtml(narrative);

    // 5. Return HTML with appropriate headers
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="narrative-${narrativeId}.html"`);
    res.status(200).send(htmlContent);

  } catch (error) {
    logger.error('[Narrative] Failed to export narrative PDF:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Narrative not found'
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to export narrative'
    });
  }
}

/**
 * Generate HTML document for narrative PDF export
 */
function generateNarrativePdfHtml(narrative: any): string {
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };

  const chaptersHtml = narrative.chapters?.map((chapter: any) => `
    <div class="chapter">
      <h2>Chapter ${chapter.number}: ${chapter.title}</h2>
      ${chapter.content.split('\n\n').map((p: string) => `<p>${p}</p>`).join('')}
      ${chapter.evidence?.length > 0 ? `
        <div class="evidence-section">
          <h4>Supporting Evidence</h4>
          <ul>
            ${chapter.evidence.map((ev: any) => `
              <li>
                <strong>${ev.description}</strong>
                <span class="timestamp">${formatDate(ev.timestamp)}</span>
                ${ev.actor ? `<span class="actor">By: ${ev.actor}</span>` : ''}
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  `).join('') || '';

  const timelineHtml = narrative.timeline?.map((event: any) => `
    <div class="timeline-event ${event.category}">
      <div class="event-date">${formatDate(event.date)}</div>
      <div class="event-content">
        <h4>${event.title}</h4>
        <p>${event.description}</p>
        ${event.impact !== 0 ? `<span class="impact ${event.impact > 0 ? 'negative' : 'positive'}">${event.impact > 0 ? '+' : ''}${formatCurrency(event.impact)}</span>` : ''}
      </div>
    </div>
  `).join('') || '';

  const takeawaysHtml = narrative.keyTakeaways?.map((t: string) => `<li>${t}</li>`).join('') || '';
  const recommendationsHtml = narrative.recommendations?.map((r: string, i: number) => `<li><strong>${i + 1}.</strong> ${r}</li>`).join('') || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${narrative.title || 'Portfolio Variance Narrative'}</title>
  <style>
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .chapter { page-break-inside: avoid; }
      .no-print { display: none; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; line-height: 1.6; color: #1f2937; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
    h1 { font-size: 28px; color: #111827; margin-bottom: 8px; border-bottom: 3px solid #3b82f6; padding-bottom: 12px; }
    h2 { font-size: 20px; color: #374151; margin: 24px 0 12px; }
    h3 { font-size: 16px; color: #4b5563; margin: 20px 0 8px; }
    h4 { font-size: 14px; color: #6b7280; margin: 12px 0 4px; }
    p { margin-bottom: 12px; color: #374151; }
    .header-meta { display: flex; gap: 24px; margin-bottom: 24px; color: #6b7280; font-size: 14px; }
    .header-meta span { display: flex; align-items: center; gap: 4px; }
    .summary-box { background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0; }
    .summary-box h3 { margin-top: 0; color: #1e40af; }
    .chapter { margin: 32px 0; padding: 20px; background: #fafafa; border-radius: 8px; }
    .chapter h2 { margin-top: 0; color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
    .evidence-section { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin-top: 16px; }
    .evidence-section h4 { color: #4b5563; margin-bottom: 8px; }
    .evidence-section ul { list-style: none; }
    .evidence-section li { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .evidence-section li:last-child { border-bottom: none; }
    .timestamp { color: #9ca3af; font-size: 12px; margin-left: 8px; }
    .actor { color: #6b7280; font-size: 12px; margin-left: 8px; }
    .timeline { margin: 24px 0; }
    .timeline-event { display: flex; gap: 16px; padding: 12px 0; border-left: 2px solid #e5e7eb; margin-left: 20px; padding-left: 20px; position: relative; }
    .timeline-event::before { content: ''; position: absolute; left: -6px; top: 16px; width: 10px; height: 10px; border-radius: 50%; background: #3b82f6; }
    .timeline-event.plan::before { background: #3b82f6; }
    .timeline-event.event::before { background: #f59e0b; }
    .timeline-event.impact::before { background: #ef4444; }
    .timeline-event.outcome::before { background: #10b981; }
    .event-date { min-width: 100px; font-size: 12px; color: #6b7280; }
    .event-content h4 { margin: 0 0 4px; color: #1f2937; }
    .event-content p { margin: 0; font-size: 14px; }
    .impact { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-top: 4px; }
    .impact.negative { background: #fee2e2; color: #991b1b; }
    .impact.positive { background: #d1fae5; color: #065f46; }
    .takeaways, .recommendations { margin: 24px 0; padding: 16px; border-radius: 8px; }
    .takeaways { background: #ecfdf5; border-left: 4px solid #10b981; }
    .takeaways h3 { color: #065f46; }
    .recommendations { background: #fff7ed; border-left: 4px solid #f59e0b; }
    .recommendations h3 { color: #9a3412; }
    .takeaways ul, .recommendations ul { margin-left: 20px; }
    .takeaways li, .recommendations li { margin: 8px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; text-align: center; }
    .print-btn { position: fixed; top: 20px; right: 20px; padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .print-btn:hover { background: #2563eb; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>

  <h1>${narrative.title || 'Portfolio Variance Narrative'}</h1>

  <div class="header-meta">
    <span>📊 ${narrative.metadata?.organizationName || narrative.metadata?.organizationCode || 'Organization'}</span>
    <span>📖 ${narrative.chapters?.length || 0} Chapters</span>
    <span>⏱️ ${narrative.estimatedReadTime || 5} min read</span>
    <span>📅 ${formatDate(narrative.metadata?.generatedAt || new Date())}</span>
  </div>

  ${narrative.metadata ? `
    <div class="summary-box">
      <h3>Executive Summary</h3>
      <p><strong>Total Variance:</strong> ${formatCurrency(narrative.metadata.totalVariance || 0)} (${(narrative.metadata.variancePercent || 0).toFixed(1)}%)</p>
      <p><strong>Affected Records:</strong> ${narrative.metadata.affectedRecords || 0}</p>
    </div>
  ` : ''}

  ${chaptersHtml}

  ${narrative.timeline?.length > 0 ? `
    <h3>Timeline of Events</h3>
    <div class="timeline">
      ${timelineHtml}
    </div>
  ` : ''}

  ${narrative.keyTakeaways?.length > 0 ? `
    <div class="takeaways">
      <h3>✓ Key Takeaways</h3>
      <ul>${takeawaysHtml}</ul>
    </div>
  ` : ''}

  ${narrative.recommendations?.length > 0 ? `
    <div class="recommendations">
      <h3>⚡ Recommendations</h3>
      <ul>${recommendationsHtml}</ul>
    </div>
  ` : ''}

  <div class="footer">
    <p>Generated by PFA Vanguard • ${formatDate(new Date())}</p>
    <p>This document is confidential and intended for internal use only.</p>
  </div>
</body>
</html>`;
}

// ============================================================================
// ASSET ARBITRAGE DETECTOR ENDPOINTS (UC-23)
// ============================================================================

const arbitrageService = new ArbitrageDetectorService();

/**
 * GET /api/beo/arbitrage/opportunities
 *
 * Detect and list arbitrage opportunities across organizations
 *
 * Response:
 * {
 *   "success": true,
 *   "opportunities": ArbitrageOpportunityDetailed[],
 *   "summary": {
 *     "totalOpportunities": number,
 *     "feasibleOpportunities": number,
 *     "totalPotentialSavings": number,
 *     "totalNetSavings": number
 *   },
 *   "metadata": {
 *     "organizationsAnalyzed": number,
 *     "idlePeriodsFound": number,
 *     "needsFound": number,
 *     "latencyMs": number
 *   }
 * }
 */
export async function getArbitrageOpportunities(req: AuthRequest, res: Response): Promise<void> {
  try {
    // 1. Authentication check
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      return;
    }

    // 2. Authorization check: Require perm_ViewAllOrgs capability (BEO access)
    const hasPortfolioAccess = req.user.organizations.some(
      org => {
        const capabilities = (org as any).capabilities || {};
        return capabilities['perm_ViewAllOrgs'] === true;
      }
    );

    if (!hasPortfolioAccess) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'BEO portfolio access required (perm_ViewAllOrgs capability)'
      });
      return;
    }

    // 3. Detect opportunities
    logger.info(`[Arbitrage] User ${req.user.userId} requesting arbitrage opportunities`);
    const startTime = Date.now();

    const opportunities = await arbitrageService.detectOpportunities(req.user.userId);

    const latency = Date.now() - startTime;

    // 4. Calculate summary statistics
    const feasibleOpportunities = opportunities.filter(o => o.isFeasible);
    const totalPotentialSavings = opportunities.reduce((sum, o) => sum + o.potentialSavings, 0);
    const totalNetSavings = opportunities.reduce((sum, o) => sum + o.netSavings, 0);

    // 5. Return success response
    res.status(200).json({
      success: true,
      opportunities,
      summary: {
        totalOpportunities: opportunities.length,
        feasibleOpportunities: feasibleOpportunities.length,
        totalPotentialSavings: Math.round(totalPotentialSavings),
        totalNetSavings: Math.round(totalNetSavings),
      },
      metadata: {
        organizationsAnalyzed: new Set(opportunities.flatMap(o => [o.sourceOrgId, o.destOrgId])).size,
        latencyMs: latency,
      },
    });
  } catch (error) {
    logger.error('[Arbitrage] Error detecting opportunities:', error);

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to detect arbitrage opportunities'
    });
  }
}

/**
 * POST /api/beo/arbitrage/propose-transfer
 *
 * Create a transfer proposal based on detected opportunity
 *
 * Request Body:
 * {
 *   "opportunityId": string  // Format: arb-{sourcePfaId}-{destPfaId}
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "proposalId": string,
 *   "message": string
 * }
 */
export async function proposeArbitrageTransfer(req: AuthRequest, res: Response): Promise<void> {
  try {
    // 1. Authentication check
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      return;
    }

    // 2. Authorization check: Require perm_ViewAllOrgs capability (BEO access)
    const hasPortfolioAccess = req.user.organizations.some(
      org => {
        const capabilities = (org as any).capabilities || {};
        return capabilities['perm_ViewAllOrgs'] === true;
      }
    );

    if (!hasPortfolioAccess) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'BEO portfolio access required (perm_ViewAllOrgs capability)'
      });
      return;
    }

    // 3. Validate input
    const { opportunityId } = req.body;

    if (!opportunityId || typeof opportunityId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'opportunityId is required and must be a string'
      });
      return;
    }

    // 4. Propose transfer
    logger.info(`[Arbitrage] User ${req.user.userId} proposing transfer ${opportunityId}`);

    const proposal = await arbitrageService.proposeTransfer(opportunityId, req.user.userId);

    // 5. Return success response
    res.status(201).json({
      success: true,
      proposalId: proposal.id,
      message: 'Transfer proposal created successfully'
    });
  } catch (error) {
    logger.error('[Arbitrage] Error proposing transfer:', error);

    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('no longer valid')) {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: error.message
        });
        return;
      }

      if (error.message.includes('Invalid opportunity ID')) {
        res.status(400).json({
          success: false,
          error: 'BAD_REQUEST',
          message: error.message
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to propose transfer'
    });
  }
}

// ============================================================================
// VENDOR PRICING WATCHDOG ENDPOINTS (UC-24)
// ============================================================================

import { VendorPricingWatchdogService } from '../services/ai/VendorPricingWatchdogService';

const vendorPricingService = new VendorPricingWatchdogService();

/**
 * GET /api/beo/vendor-pricing/analysis
 * Get comprehensive vendor pricing analysis
 */
export async function getVendorPricingAnalysis(_req: AuthRequest, res: Response) {
  const startTime = Date.now();

  try {
    logger.info('[VendorPricing] Analysis request started');

    // Run pricing analysis
    const analysis = await vendorPricingService.analyzeVendorPricing();

    // Persist anomalies for tracking
    if (analysis.anomalies.length > 0) {
      await vendorPricingService.persistAnomalies(analysis.anomalies);
    }

    const latency = Date.now() - startTime;

    res.status(200).json({
      success: true,
      analysis,
      metadata: {
        latencyMs: latency,
        timestamp: new Date().toISOString(),
      },
    });

    logger.info(`[VendorPricing] Analysis completed in ${latency}ms`);

  } catch (error) {
    logger.error('[VendorPricing] Analysis failed:', error);

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to analyze vendor pricing'
    });
  }
}

/**
 * GET /api/beo/vendor-pricing/anomalies
 * Get active pricing anomalies
 */
export async function getActiveAnomalies(_req: AuthRequest, res: Response) {
  try {
    logger.info('[VendorPricing] Fetching active anomalies');

    const anomalies = await vendorPricingService.getActiveAnomalies();

    res.status(200).json({
      success: true,
      anomalies,
      count: anomalies.length,
    });

  } catch (error) {
    logger.error('[VendorPricing] Failed to fetch anomalies:', error);

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch anomalies'
    });
  }
}

/**
 * POST /api/beo/vendor-pricing/dismiss-anomaly/:id
 * Dismiss a pricing anomaly
 */
export async function dismissAnomaly(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Anomaly ID is required'
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      return;
    }

    logger.info(`[VendorPricing] User ${req.user.userId} dismissing anomaly ${id}`);

    await vendorPricingService.dismissAnomaly(id, req.user.userId);

    res.status(200).json({
      success: true,
      message: 'Anomaly dismissed successfully'
    });

  } catch (error) {
    logger.error('[VendorPricing] Failed to dismiss anomaly:', error);

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to dismiss anomaly'
    });
  }
}

/**
 * GET /api/beo/vendor-pricing/scorecard
 * Get vendor performance scorecard
 */
export async function getVendorScorecard(_req: AuthRequest, res: Response) {
  try {
    logger.info('[VendorPricing] Fetching vendor scorecard');

    // Run analysis to get scorecards
    const analysis = await vendorPricingService.analyzeVendorPricing();

    res.status(200).json({
      success: true,
      scorecards: analysis.vendorScorecards,
      summary: analysis.summary,
    });

  } catch (error) {
    logger.error('[VendorPricing] Failed to fetch scorecard:', error);

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch vendor scorecard'
    });
  }
}

// ============================================================================
// MULTIVERSE SCENARIO SIMULATOR ENDPOINTS (UC-25)
// ============================================================================

import { scenarioSimulatorService } from '../services/ai/ScenarioSimulatorService';

/**
 * POST /api/beo/scenario/simulate
 *
 * Run what-if scenario simulation with optional Monte Carlo analysis
 *
 * Request Body:
 * {
 *   "organizationIds": string[],
 *   "parameters": {
 *     "type": "timeline_shift" | "vendor_switch" | "consolidation" | "budget_cut" | "weather_delay",
 *     "shiftDays"?: number,
 *     "targetVendor"?: string,
 *     "sourceVendor"?: string,
 *     "consolidationPercent"?: number,
 *     "budgetCutPercent"?: number,
 *     "monteCarloEnabled"?: boolean,
 *     "iterations"?: number
 *   }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "scenarioId": string,
 *   "scenarioType": string,
 *   "parameters": {...},
 *   "baselineMetrics": {...},
 *   "scenarioMetrics": {...},
 *   "impact": {...},
 *   "riskAnalysis"?: {...},  // Only if Monte Carlo enabled
 *   "timeline": {...}
 * }
 */
export async function simulateScenario(req: AuthRequest, res: Response): Promise<void> {
  const startTime = Date.now();

  try {
    // 1. Authentication check
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      return;
    }

    // 2. Authorization check: Require perm_ViewAllOrgs capability (BEO access)
    const hasPortfolioAccess = req.user.organizations.some(
      org => {
        const capabilities = (org as any).capabilities || {};
        return capabilities['perm_ViewAllOrgs'] === true;
      }
    );

    if (!hasPortfolioAccess) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'BEO portfolio access required (perm_ViewAllOrgs capability)'
      });
      return;
    }

    // 3. Validate input
    const { organizationIds, parameters } = req.body;

    if (!Array.isArray(organizationIds) || organizationIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'organizationIds must be a non-empty array'
      });
      return;
    }

    if (!parameters || typeof parameters !== 'object') {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'parameters object is required'
      });
      return;
    }

    // Validate scenario type
    const validTypes = ['timeline_shift', 'vendor_switch', 'consolidation', 'budget_cut', 'weather_delay'];
    if (!validTypes.includes(parameters.type)) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: `Invalid scenario type. Must be one of: ${validTypes.join(', ')}`
      });
      return;
    }

    // Validate parameter ranges
    if (parameters.shiftDays !== undefined && (parameters.shiftDays < -365 || parameters.shiftDays > 365)) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'shiftDays must be between -365 and 365'
      });
      return;
    }

    if (parameters.consolidationPercent !== undefined && (parameters.consolidationPercent < 0 || parameters.consolidationPercent > 100)) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'consolidationPercent must be between 0 and 100'
      });
      return;
    }

    if (parameters.budgetCutPercent !== undefined && (parameters.budgetCutPercent < 0 || parameters.budgetCutPercent > 50)) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'budgetCutPercent must be between 0 and 50'
      });
      return;
    }

    // 4. Run simulation
    logger.info(`[Scenario] User ${req.user.userId} simulating ${parameters.type} for ${organizationIds.length} orgs`);

    const result = await scenarioSimulatorService.simulateScenario(
      organizationIds,
      parameters,
      req.user.userId
    );

    const latency = Date.now() - startTime;
    logger.info(`[Scenario] Simulation completed in ${latency}ms (${parameters.monteCarloEnabled ? 'Monte Carlo' : 'single run'})`);

    // 5. Return success response
    res.status(200).json({
      success: true,
      ...result,
      metadata: {
        latencyMs: latency,
      },
    });
  } catch (error) {
    logger.error('[Scenario] Simulation failed:', error);

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to run scenario simulation'
    });
  }
}

/**
 * GET /api/beo/scenario/list
 *
 * List user's scenario simulations
 *
 * Response:
 * {
 *   "success": true,
 *   "scenarios": [...]
 * }
 */
export async function listScenarios(req: AuthRequest, res: Response): Promise<void> {
  try {
    // 1. Authentication check
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      return;
    }

    // 2. Authorization check
    const hasPortfolioAccess = req.user.organizations.some(
      org => {
        const capabilities = (org as any).capabilities || {};
        return capabilities['perm_ViewAllOrgs'] === true;
      }
    );

    if (!hasPortfolioAccess) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'BEO portfolio access required (perm_ViewAllOrgs capability)'
      });
      return;
    }

    // 3. Get scenarios
    logger.info(`[Scenario] User ${req.user.userId} listing scenarios`);

    const scenarios = await scenarioSimulatorService.listUserScenarios(req.user.userId);

    // 4. Return success response
    res.status(200).json({
      success: true,
      scenarios,
      count: scenarios.length,
    });
  } catch (error) {
    logger.error('[Scenario] Failed to list scenarios:', error);

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to list scenarios'
    });
  }
}

/**
 * POST /api/beo/scenario/compare
 *
 * Compare multiple scenario simulations side-by-side
 *
 * Request Body:
 * {
 *   "scenarioIds": string[]
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "scenarios": [...],
 *   "comparisonMatrix": {...}
 * }
 */
export async function compareScenarios(req: AuthRequest, res: Response): Promise<void> {
  try {
    // 1. Authentication check
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      return;
    }

    // 2. Authorization check
    const hasPortfolioAccess = req.user.organizations.some(
      org => {
        const capabilities = (org as any).capabilities || {};
        return capabilities['perm_ViewAllOrgs'] === true;
      }
    );

    if (!hasPortfolioAccess) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'BEO portfolio access required (perm_ViewAllOrgs capability)'
      });
      return;
    }

    // 3. Validate input
    const { scenarioIds } = req.body;

    if (!Array.isArray(scenarioIds) || scenarioIds.length < 2) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'scenarioIds must be an array with at least 2 items'
      });
      return;
    }

    if (scenarioIds.length > 5) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Cannot compare more than 5 scenarios at once'
      });
      return;
    }

    // 4. Compare scenarios
    logger.info(`[Scenario] User ${req.user.userId} comparing ${scenarioIds.length} scenarios`);

    const comparison = await scenarioSimulatorService.compareScenarios(scenarioIds);

    // 5. Return success response
    res.status(200).json({
      success: true,
      ...comparison,
    });
  } catch (error) {
    logger.error('[Scenario] Failed to compare scenarios:', error);

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to compare scenarios'
    });
  }
}

/**
 * GET /api/beo/scenario/:scenarioId
 *
 * Get scenario simulation by ID
 *
 * Response:
 * {
 *   "success": true,
 *   "scenario": {...}
 * }
 */
export async function getScenario(req: AuthRequest, res: Response): Promise<void> {
  try {
    // 1. Authentication check
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      return;
    }

    // 2. Get scenario ID from params
    const { scenarioId } = req.params;

    if (!scenarioId) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'scenarioId is required'
      });
      return;
    }

    // 3. Fetch scenario
    logger.info(`[Scenario] User ${req.user.userId} fetching scenario ${scenarioId}`);

    const scenario = await scenarioSimulatorService.getScenario(scenarioId);

    if (!scenario) {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Scenario not found'
      });
      return;
    }

    // 4. Return success response
    res.status(200).json({
      success: true,
      scenario,
    });
  } catch (error) {
    logger.error('[Scenario] Failed to fetch scenario:', error);

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve scenario'
    });
  }
}

/**
 * GET /api/beo/scenario/:scenarioId/export-pdf
 *
 * Export scenario as PDF (returns HTML for client-side PDF conversion)
 *
 * Response: HTML document styled for PDF printing
 */
export async function exportScenarioPDF(req: AuthRequest, res: Response): Promise<void> {
  try {
    // 1. Authentication check
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      return;
    }

    // 2. Get scenario ID from params
    const { scenarioId } = req.params;

    if (!scenarioId) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'scenarioId is required'
      });
      return;
    }

    // 3. Fetch scenario
    logger.info(`[Scenario] User ${req.user.userId} exporting scenario ${scenarioId} as PDF`);

    const scenario = await scenarioSimulatorService.getScenario(scenarioId);

    if (!scenario) {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Scenario not found'
      });
      return;
    }

    // 4. Generate HTML document for PDF export
    const htmlContent = generateScenarioPdfHtml(scenario);

    // 5. Return HTML with appropriate headers
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="scenario-${scenarioId}.html"`);
    res.status(200).send(htmlContent);

  } catch (error) {
    logger.error('[Scenario] Failed to export scenario PDF:', error);

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to export scenario'
    });
  }
}

/**
 * Generate HTML document for scenario PDF export
 */
function generateScenarioPdfHtml(scenario: any): string {
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const scenarioTypeLabels: Record<string, string> = {
    timeline_shift: 'Timeline Shift',
    vendor_switch: 'Vendor Switch',
    consolidation: 'Equipment Consolidation',
    budget_cut: 'Budget Reduction',
    weather_delay: 'Weather Delay Impact',
  };

  const baselineMetrics = scenario.baselineMetrics || {};
  const scenarioMetrics = scenario.scenarioMetrics || {};
  const impact = scenario.impact || {};
  const riskAnalysis = scenario.riskAnalysis;
  const params = scenario.parameters || {};

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scenario Analysis - ${scenarioTypeLabels[scenario.scenarioType] || scenario.scenarioType}</title>
  <style>
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .section { page-break-inside: avoid; }
      .no-print { display: none; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; line-height: 1.6; color: #1f2937; max-width: 900px; margin: 0 auto; padding: 40px 20px; }
    h1 { font-size: 28px; color: #111827; margin-bottom: 8px; border-bottom: 3px solid #8b5cf6; padding-bottom: 12px; }
    h2 { font-size: 18px; color: #374151; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
    h3 { font-size: 14px; color: #6b7280; margin: 16px 0 8px; text-transform: uppercase; letter-spacing: 0.05em; }
    .header-meta { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; color: #6b7280; font-size: 14px; }
    .header-meta span { display: flex; align-items: center; gap: 4px; background: #f3f4f6; padding: 4px 12px; border-radius: 16px; }
    .section { margin: 24px 0; padding: 20px; background: #fafafa; border-radius: 8px; border: 1px solid #e5e7eb; }
    .metrics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .metric-card { background: white; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb; }
    .metric-card h4 { font-size: 12px; color: #6b7280; margin-bottom: 4px; text-transform: uppercase; }
    .metric-card .value { font-size: 24px; font-weight: 700; color: #1f2937; }
    .metric-card .change { font-size: 14px; margin-top: 4px; }
    .metric-card .change.positive { color: #059669; }
    .metric-card .change.negative { color: #dc2626; }
    .comparison-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .comparison-table th, .comparison-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    .comparison-table th { background: #f9fafb; font-weight: 600; color: #374151; font-size: 13px; }
    .comparison-table td { font-size: 14px; }
    .comparison-table .baseline { color: #6b7280; }
    .comparison-table .scenario { color: #1f2937; font-weight: 500; }
    .comparison-table .impact { font-weight: 600; }
    .comparison-table .impact.positive { color: #059669; }
    .comparison-table .impact.negative { color: #dc2626; }
    .risk-section { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 24px 0; }
    .risk-section h3 { color: #92400e; margin-bottom: 12px; }
    .risk-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .risk-item { background: white; padding: 12px; border-radius: 6px; text-align: center; }
    .risk-item .label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
    .risk-item .value { font-size: 18px; font-weight: 700; margin-top: 4px; }
    .params-list { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    .param-tag { background: #e0e7ff; color: #3730a3; padding: 4px 12px; border-radius: 16px; font-size: 13px; }
    .summary-box { background: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0; }
    .summary-box h3 { color: #065f46; margin-bottom: 8px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; text-align: center; }
    .print-btn { position: fixed; top: 20px; right: 20px; padding: 10px 20px; background: #8b5cf6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .print-btn:hover { background: #7c3aed; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>

  <h1>📊 Scenario Analysis Report</h1>

  <div class="header-meta">
    <span>🎯 ${scenarioTypeLabels[scenario.scenarioType] || scenario.scenarioType}</span>
    <span>🆔 ${scenario.scenarioId}</span>
    <span>📅 ${formatDate(scenario.createdAt || new Date())}</span>
    ${riskAnalysis ? '<span>🎲 Monte Carlo Analysis</span>' : ''}
  </div>

  <!-- Scenario Parameters -->
  <div class="section">
    <h2>Scenario Parameters</h2>
    <div class="params-list">
      ${params.shiftDays !== undefined ? `<span class="param-tag">Shift: ${params.shiftDays > 0 ? '+' : ''}${params.shiftDays} days</span>` : ''}
      ${params.budgetCutPercent !== undefined ? `<span class="param-tag">Budget Cut: ${params.budgetCutPercent}%</span>` : ''}
      ${params.consolidationPercent !== undefined ? `<span class="param-tag">Consolidation: ${params.consolidationPercent}%</span>` : ''}
      ${params.targetVendor ? `<span class="param-tag">Target Vendor: ${params.targetVendor}</span>` : ''}
      ${params.sourceVendor ? `<span class="param-tag">From Vendor: ${params.sourceVendor}</span>` : ''}
      ${params.monteCarloEnabled ? `<span class="param-tag">Iterations: ${params.iterations || 1000}</span>` : ''}
    </div>
  </div>

  <!-- Key Metrics Comparison -->
  <div class="section">
    <h2>Key Metrics Comparison</h2>
    <table class="comparison-table">
      <thead>
        <tr>
          <th>Metric</th>
          <th>Baseline</th>
          <th>Scenario</th>
          <th>Impact</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Total Cost</td>
          <td class="baseline">${formatCurrency(baselineMetrics.totalCost || 0)}</td>
          <td class="scenario">${formatCurrency(scenarioMetrics.totalCost || 0)}</td>
          <td class="impact ${(impact.costDelta || 0) < 0 ? 'positive' : 'negative'}">${formatCurrency(impact.costDelta || 0)} (${formatPercent(impact.costDeltaPercent || 0)})</td>
        </tr>
        <tr>
          <td>Active Equipment</td>
          <td class="baseline">${(baselineMetrics.activeEquipment || 0).toLocaleString()}</td>
          <td class="scenario">${(scenarioMetrics.activeEquipment || 0).toLocaleString()}</td>
          <td class="impact">${impact.equipmentDelta || 0}</td>
        </tr>
        <tr>
          <td>Utilization Rate</td>
          <td class="baseline">${(baselineMetrics.utilizationRate || 0).toFixed(1)}%</td>
          <td class="scenario">${(scenarioMetrics.utilizationRate || 0).toFixed(1)}%</td>
          <td class="impact ${(impact.utilizationDelta || 0) > 0 ? 'positive' : 'negative'}">${formatPercent(impact.utilizationDelta || 0)}</td>
        </tr>
        <tr>
          <td>Schedule Risk</td>
          <td class="baseline">${(baselineMetrics.scheduleRisk || 0).toFixed(1)}%</td>
          <td class="scenario">${(scenarioMetrics.scheduleRisk || 0).toFixed(1)}%</td>
          <td class="impact ${(impact.scheduleRiskDelta || 0) < 0 ? 'positive' : 'negative'}">${formatPercent(impact.scheduleRiskDelta || 0)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  ${riskAnalysis ? `
  <!-- Monte Carlo Risk Analysis -->
  <div class="risk-section">
    <h3>🎲 Monte Carlo Risk Analysis</h3>
    <div class="risk-grid">
      <div class="risk-item">
        <div class="label">Best Case</div>
        <div class="value" style="color: #059669;">${formatCurrency(riskAnalysis.bestCase || 0)}</div>
      </div>
      <div class="risk-item">
        <div class="label">Expected (P50)</div>
        <div class="value">${formatCurrency(riskAnalysis.expected || 0)}</div>
      </div>
      <div class="risk-item">
        <div class="label">Worst Case</div>
        <div class="value" style="color: #dc2626;">${formatCurrency(riskAnalysis.worstCase || 0)}</div>
      </div>
      <div class="risk-item">
        <div class="label">Standard Deviation</div>
        <div class="value">${formatCurrency(riskAnalysis.standardDeviation || 0)}</div>
      </div>
      <div class="risk-item">
        <div class="label">Confidence (95%)</div>
        <div class="value">${formatCurrency(riskAnalysis.confidenceInterval?.lower || 0)} - ${formatCurrency(riskAnalysis.confidenceInterval?.upper || 0)}</div>
      </div>
      <div class="risk-item">
        <div class="label">Success Probability</div>
        <div class="value">${((riskAnalysis.successProbability || 0) * 100).toFixed(1)}%</div>
      </div>
    </div>
  </div>
  ` : ''}

  <!-- Summary -->
  <div class="summary-box">
    <h3>📋 Executive Summary</h3>
    <p>
      This ${scenarioTypeLabels[scenario.scenarioType]?.toLowerCase() || 'scenario'} analysis projects a
      <strong>${(impact.costDeltaPercent || 0) < 0 ? 'savings' : 'cost increase'} of ${formatCurrency(Math.abs(impact.costDelta || 0))}</strong>
      (${formatPercent(impact.costDeltaPercent || 0)}) compared to baseline.
      ${riskAnalysis ? `With 95% confidence, the outcome will fall between ${formatCurrency(riskAnalysis.confidenceInterval?.lower || 0)} and ${formatCurrency(riskAnalysis.confidenceInterval?.upper || 0)}.` : ''}
    </p>
  </div>

  <div class="footer">
    <p>Generated by PFA Vanguard Scenario Simulator • ${formatDate(new Date())}</p>
    <p>This analysis is based on historical data and statistical modeling. Actual results may vary.</p>
  </div>
</body>
</html>`;
}
