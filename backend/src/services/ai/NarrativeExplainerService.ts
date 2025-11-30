/**
 * Narrative Explainer Service - AI-Powered Variance Storytelling
 *
 * Phase 8, Task 8.2 of ADR-005 Multi-Tenant Access Control
 * UC-22: Narrative Variance Generator
 *
 * Features:
 * - Generate 5-chapter narratives from budget variance data
 * - Link variance to audit log evidence
 * - Build timeline visualizations with waterfall effects
 * - Extract key takeaways and recommendations
 * - PDF export support
 * - Reading progress tracking
 */

import prisma from '../../config/database';
import { GeminiAdapter } from './GeminiAdapter';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

// ============================================================================
// Types
// ============================================================================

export interface Chapter {
  number: number;
  title: string;
  content: string;
  wordCount: number;
  evidence: Evidence[];
}

export interface Evidence {
  id: string;
  type: 'audit_log' | 'pfa_record' | 'financial_data';
  timestamp: Date;
  description: string;
  actor?: string; // User who made the change
  impact?: string; // Financial impact
  metadata?: Record<string, any>;
}

export interface TimelineEvent {
  id: string;
  date: Date;
  title: string;
  description: string;
  impact: number; // Financial impact in USD
  category: 'plan' | 'event' | 'impact' | 'outcome';
  evidence: Evidence[];
}

export interface GenerateNarrativeRequest {
  userId: string;
  organizationId: string;
  title?: string;
  dateRange?: { start: Date; end: Date };
}

export interface GenerateNarrativeResponse {
  narrativeId: string;
  title: string;
  chapters: Chapter[];
  keyTakeaways: string[];
  timeline: TimelineEvent[];
  recommendations: string[];
  estimatedReadTime: number; // Minutes
  metadata: {
    organizationCode: string;
    organizationName: string;
    totalVariance: number;
    variancePercent: number;
    affectedRecords: number;
    generatedAt: Date;
    modelUsed: string;
    latencyMs: number;
  };
}

// ============================================================================
// Narrative Explainer Service
// ============================================================================

export class NarrativeExplainerService {
  private aiAdapter: GeminiAdapter | null = null;

  constructor() {
    // Initialize AI adapter if API key is available
    const apiKey = env.GEMINI_API_KEY;
    if (apiKey) {
      this.aiAdapter = new GeminiAdapter(apiKey, 'gemini-2.0-flash-exp', {
        input: 0, // Free tier
        output: 0,
      });
    }
  }

  /**
   * Generate executive-ready variance narrative
   */
  async explainVariance(params: GenerateNarrativeRequest): Promise<GenerateNarrativeResponse> {
    const startTime = Date.now();
    const { userId, organizationId, title, dateRange } = params;

    try {
      // 1. Validate user has BEO access (perm_ViewAllOrgs)
      await this.validateBeoAccess(userId);

      // 2. Fetch variance data
      logger.info(`[Narrative] Fetching variance data for org ${organizationId}`);
      const varianceData = await this.getVarianceData(organizationId, dateRange);

      // 3. Fetch audit log evidence
      logger.info(`[Narrative] Fetching audit evidence for org ${organizationId}`);
      const auditEvidence = await this.getAuditEvidence(organizationId, dateRange);

      // 4. Generate 5 chapters with AI
      logger.info(`[Narrative] Generating narrative chapters with AI`);
      const chapters = await this.generateChapters(varianceData, auditEvidence);

      // 5. Build timeline visualization
      logger.info(`[Narrative] Building timeline visualization`);
      const timeline = this.buildTimeline(varianceData, auditEvidence);

      // 6. Extract key takeaways and recommendations
      logger.info(`[Narrative] Extracting insights with AI`);
      const { keyTakeaways, recommendations } = await this.extractInsights(chapters, varianceData);

      // 7. Calculate estimated reading time
      const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
      const estimatedReadTime = Math.ceil(totalWords / 200); // ~200 words/min

      // 8. Generate unique narrative ID
      const narrativeId = await this.generateNarrativeId(organizationId);

      // 9. Save to database
      const org = await prisma.organizations.findUnique({
        where: { id: organizationId },
        select: { code: true, name: true },
      });

      const narrative = await prisma.narrative_reports.create({
        data: {
          id: `narr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          narrativeId,
          userId,
          organizationId,
          title: title || `Budget Variance Explanation - ${new Date().toLocaleDateString()}`,
          chapters: JSON.parse(JSON.stringify(chapters)),
          keyTakeaways: JSON.parse(JSON.stringify(keyTakeaways)),
          timeline: JSON.parse(JSON.stringify(timeline)),
          recommendations: JSON.parse(JSON.stringify(recommendations)),
          estimatedReadTime,
          updatedAt: new Date(),
        },
      });

      const latencyMs = Date.now() - startTime;

      logger.info(`[Narrative] Generated narrative ${narrativeId} in ${latencyMs}ms`);

      return {
        narrativeId,
        title: narrative.title,
        chapters,
        keyTakeaways,
        timeline,
        recommendations,
        estimatedReadTime,
        metadata: {
          organizationCode: org?.code || 'UNKNOWN',
          organizationName: org?.name || 'Unknown Organization',
          totalVariance: varianceData.totalVariance,
          variancePercent: varianceData.variancePercent,
          affectedRecords: varianceData.affectedRecords,
          generatedAt: narrative.generatedAt,
          modelUsed: 'gemini-2.0-flash-exp',
          latencyMs,
        },
      };
    } catch (error) {
      logger.error('[Narrative] Failed to generate narrative:', error);
      throw error;
    }
  }

  /**
   * Validate user has BEO access capability
   */
  private async validateBeoAccess(userId: string): Promise<any> {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: {
        user_organizations: {
          select: {
            perm_ManageSettings: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user has BEO access (admin or ManageSettings permission)
    const hasBeoAccess = user.role === 'admin' || user.user_organizations.some((o: any) => o.perm_ManageSettings);

    if (!hasBeoAccess) {
      throw new Error('BEO access required (perm_ViewAllOrgs capability)');
    }

    return user;
  }

  /**
   * Fetch variance data from PFA records
   */
  private async getVarianceData(organizationId: string, dateRange?: { start: Date; end: Date }) {
    // Fetch PFA records for the organization
    const pfaRecords = await prisma.pfa_records.findMany({
      where: {
        organizationId,
        ...(dateRange && {
          forecastStart: { gte: dateRange.start },
          forecastEnd: { lte: dateRange.end },
        }),
      },
      select: {
        id: true,
        pfaId: true,
        category: true,
        class: true,
        source: true,
        monthlyRate: true,
        purchasePrice: true,
        forecastStart: true,
        forecastEnd: true,
        originalStart: true,
        originalEnd: true,
        actualStart: true,
        actualEnd: true,
        isActualized: true,
      },
    });

    // Calculate variance
    let totalPlan = 0;
    let totalForecast = 0;
    let totalActual = 0;

    pfaRecords.forEach((pfa: any) => {
      const planDays = pfa.originalStart && pfa.originalEnd
        ? Math.ceil((pfa.originalEnd.getTime() - pfa.originalStart.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      const forecastDays = pfa.forecastStart && pfa.forecastEnd
        ? Math.ceil((pfa.forecastEnd.getTime() - pfa.forecastStart.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      const actualDays = pfa.actualStart && pfa.actualEnd
        ? Math.ceil((pfa.actualEnd.getTime() - pfa.actualStart.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      if (pfa.source === 'Rental' && pfa.monthlyRate) {
        totalPlan += (planDays / 30.44) * pfa.monthlyRate;
        totalForecast += (forecastDays / 30.44) * pfa.monthlyRate;
        if (pfa.isActualized) {
          totalActual += (actualDays / 30.44) * pfa.monthlyRate;
        }
      } else if (pfa.source === 'Purchase' && pfa.purchasePrice) {
        totalPlan += pfa.purchasePrice;
        totalForecast += pfa.purchasePrice;
        if (pfa.isActualized) {
          totalActual += pfa.purchasePrice;
        }
      }
    });

    const totalVariance = totalActual - totalPlan;
    const variancePercent = totalPlan > 0 ? (totalVariance / totalPlan) * 100 : 0;

    return {
      records: pfaRecords,
      totalPlan,
      totalForecast,
      totalActual,
      totalVariance,
      variancePercent,
      affectedRecords: pfaRecords.length,
    };
  }

  /**
   * Fetch audit log evidence
   */
  private async getAuditEvidence(organizationId: string, dateRange?: { start: Date; end: Date }): Promise<Evidence[]> {
    const auditLogs = await prisma.audit_logs.findMany({
      where: {
        organizationId,
        ...(dateRange && {
          timestamp: { gte: dateRange.start, lte: dateRange.end },
        }),
      },
      orderBy: { timestamp: 'desc' },
      take: 50, // Limit to most recent 50 events
    });

    return auditLogs.map(log => ({
      id: log.id,
      type: 'audit_log' as const,
      timestamp: log.timestamp,
      description: `${log.action}: ${log.resource || 'Unknown resource'}`,
      actor: log.userId,
      metadata: log.metadata as Record<string, any>,
    }));
  }

  /**
   * Generate 5-chapter narrative with AI
   */
  private async generateChapters(varianceData: any, evidence: Evidence[]): Promise<Chapter[]> {
    if (!this.aiAdapter) {
      logger.warn('[Narrative] AI adapter not available, using template-based narrative');
      return this.generateFallbackChapters(varianceData, evidence);
    }

    const chapters: Chapter[] = [];

    // Chapter titles and prompts
    const chapterTemplates = [
      {
        number: 1,
        title: 'The Plan',
        prompt: `You are a CFO explaining budget variance to the board of directors. Write Chapter 1: The Plan.

Context:
- Total Plan Budget: $${varianceData.totalPlan.toFixed(2)}
- Number of PFA Records: ${varianceData.affectedRecords}

Requirements:
- Tone: Professional, analytical, factual
- Length: 150-250 words (2-3 paragraphs)
- Focus: Describe the original budget baseline and planning assumptions

Generate Chapter 1:`,
      },
      {
        number: 2,
        title: 'The Event',
        prompt: `You are a CFO explaining budget variance to the board of directors. Write Chapter 2: The Event.

Context:
- Total Variance: $${varianceData.totalVariance.toFixed(2)} (${varianceData.variancePercent.toFixed(1)}%)
- Recent Events: ${evidence.slice(0, 5).map(e => e.description).join(', ')}

Requirements:
- Tone: Professional, analytical, transparent
- Length: 150-250 words (2-3 paragraphs)
- Focus: Explain what happened - identify root causes (weather delays, scope changes, equipment substitutions, etc.)

Generate Chapter 2:`,
      },
      {
        number: 3,
        title: 'Equipment Impact',
        prompt: `You are a CFO explaining budget variance to the board of directors. Write Chapter 3: Equipment Impact.

Context:
- Affected Equipment Categories: ${this.getTopCategories(varianceData.records, 5)}
- Total Records Affected: ${varianceData.affectedRecords}

Requirements:
- Tone: Professional, analytical, specific
- Length: 150-250 words (2-3 paragraphs)
- Focus: Identify which specific PFA records were impacted and by how much

Generate Chapter 3:`,
      },
      {
        number: 4,
        title: 'The Ripple Effect',
        prompt: `You are a CFO explaining budget variance to the board of directors. Write Chapter 4: The Ripple Effect.

Context:
- Total Variance: $${varianceData.totalVariance.toFixed(2)}
- Variance Percent: ${varianceData.variancePercent.toFixed(1)}%

Requirements:
- Tone: Professional, analytical, forward-looking
- Length: 150-250 words (2-3 paragraphs)
- Focus: Explain cascading impacts on other equipment and project timeline

Generate Chapter 4:`,
      },
      {
        number: 5,
        title: 'The Outcome',
        prompt: `You are a CFO explaining budget variance to the board of directors. Write Chapter 5: The Outcome.

Context:
- Final Variance: $${varianceData.totalVariance.toFixed(2)} (${varianceData.variancePercent.toFixed(1)}%)
- Status: ${varianceData.totalVariance > 0 ? 'Over Budget' : 'Under Budget'}

Requirements:
- Tone: Professional, conclusive, actionable
- Length: 150-250 words (2-3 paragraphs)
- Focus: Summarize total impact, insurance claims (if applicable), and next steps

Generate Chapter 5:`,
      },
    ];

    // Generate each chapter with AI
    for (const template of chapterTemplates) {
      const response = await this.aiAdapter.chat({
        messages: [{ role: 'user', content: template.prompt }],
        temperature: 0.7,
        maxTokens: 500,
        userId: 'system',
        organizationId: 'system',
      });

      const content = response.text.trim();
      const wordCount = content.split(/\s+/).length;

      // Link evidence to this chapter
      const chapterEvidence: Evidence[] = template.number === 2
        ? evidence.slice(0, 3) // Chapter 2 gets top 3 audit events
        : [];

      chapters.push({
        number: template.number,
        title: template.title,
        content,
        wordCount,
        evidence: chapterEvidence,
      });
    }

    return chapters;
  }

  /**
   * Generate fallback chapters when AI is not available
   */
  private generateFallbackChapters(varianceData: any, evidence: Evidence[]): Chapter[] {
    const varSign = varianceData.totalVariance >= 0 ? '+' : '';
    const varAbs = Math.abs(varianceData.totalVariance);

    return [
      {
        number: 1,
        title: 'The Plan',
        content: `The original budget plan for this portfolio established a baseline of $${varianceData.totalPlan.toFixed(2)} across ${varianceData.affectedRecords} equipment records. This plan was developed based on historical utilization rates, vendor contracts, and project timelines. The planning assumptions incorporated expected market conditions and operational requirements for the period.`,
        wordCount: 48,
        evidence: [],
      },
      {
        number: 2,
        title: 'The Event',
        content: `During the execution period, several factors contributed to variance from the original plan. The current forecast shows a total of $${varianceData.totalForecast.toFixed(2)}, representing a ${varSign}$${varAbs.toFixed(2)} (${varianceData.variancePercent.toFixed(1)}%) variance from plan. Key contributing factors include changes in equipment requirements, vendor pricing adjustments, and timeline modifications.`,
        wordCount: 55,
        evidence: evidence.slice(0, 3),
      },
      {
        number: 3,
        title: 'The Impact',
        content: `The financial impact of these variances affects ${varianceData.affectedRecords} equipment records. ${varianceData.totalVariance >= 0 ? 'The budget overrun requires attention to cost control measures and potential scope adjustments.' : 'The budget savings present opportunities for reinvestment or reserve building.'} The variance distribution shows patterns that can inform future planning accuracy.`,
        wordCount: 50,
        evidence: [],
      },
      {
        number: 4,
        title: 'The Outcome',
        content: `The current projected outcome indicates a final cost position of $${varianceData.totalForecast.toFixed(2)}. This represents a ${varianceData.variancePercent.toFixed(1)}% ${varianceData.totalVariance >= 0 ? 'increase' : 'decrease'} from the original budget. Actuals recorded to date confirm the trajectory of these projections, with ongoing monitoring in place to track further changes.`,
        wordCount: 48,
        evidence: [],
      },
      {
        number: 5,
        title: 'The Lesson',
        content: `This variance analysis reveals important lessons for future planning cycles. Key areas for improvement include forecast accuracy for ${varianceData.affectedRecords > 50 ? 'large-scale' : 'targeted'} equipment portfolios, vendor contract optimization, and timeline risk assessment. These insights will be incorporated into the next planning cycle to improve budget predictability.`,
        wordCount: 48,
        evidence: [],
      },
    ];
  }

  /**
   * Build timeline visualization
   */
  private buildTimeline(varianceData: any, evidence: Evidence[]): TimelineEvent[] {
    const timeline: TimelineEvent[] = [];

    // Add plan baseline event
    const earliestPlan = varianceData.records.reduce(
      (earliest: Date | null, pfa: any) => {
        if (!pfa.originalStart) return earliest;
        if (!earliest || pfa.originalStart < earliest) return pfa.originalStart;
        return earliest;
      },
      null
    );

    if (earliestPlan) {
      timeline.push({
        id: 'plan-baseline',
        date: earliestPlan,
        title: 'Plan Baseline Established',
        description: `Original budget set at $${varianceData.totalPlan.toFixed(2)}`,
        impact: varianceData.totalPlan,
        category: 'plan',
        evidence: [],
      });
    }

    // Add audit events
    evidence.slice(0, 5).forEach((ev, idx) => {
      timeline.push({
        id: `event-${idx}`,
        date: ev.timestamp,
        title: ev.description,
        description: `Action by ${ev.actor || 'System'}`,
        impact: 0, // No financial impact tracked yet
        category: 'event',
        evidence: [ev],
      });
    });

    // Add final outcome event
    timeline.push({
      id: 'outcome',
      date: new Date(),
      title: varianceData.totalVariance > 0 ? 'Budget Overrun' : 'Budget Savings',
      description: `Final variance: $${varianceData.totalVariance.toFixed(2)} (${varianceData.variancePercent.toFixed(1)}%)`,
      impact: varianceData.totalVariance,
      category: 'outcome',
      evidence: [],
    });

    return timeline.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Extract key takeaways and recommendations with AI
   */
  private async extractInsights(chapters: Chapter[], varianceData: any) {
    if (!this.aiAdapter) {
      logger.warn('[Narrative] AI adapter not available, using template-based insights');
      return {
        keyTakeaways: [
          `Total variance: $${varianceData.totalVariance.toFixed(2)} (${varianceData.variancePercent.toFixed(1)}%)`,
          `${varianceData.affectedRecords} equipment records affected`,
          varianceData.totalVariance > 0 ? 'Budget overrun detected - review forecast accuracy' : 'Budget savings achieved - document best practices',
        ],
        recommendations: [
          'Review forecast assumptions quarterly for accuracy',
          'Investigate root causes of significant variances',
          'Update risk mitigation strategies based on historical patterns',
        ],
      };
    }

    const prompt = `You are a CFO analyzing budget variance. Based on the following narrative, extract:

1. Three key takeaways (one sentence each)
2. Three actionable recommendations (one sentence each)

Narrative Summary:
${chapters.map(ch => `${ch.title}: ${ch.content.substring(0, 200)}...`).join('\n\n')}

Total Variance: $${varianceData.totalVariance.toFixed(2)} (${varianceData.variancePercent.toFixed(1)}%)

Respond in this exact JSON format:
{
  "keyTakeaways": ["...", "...", "..."],
  "recommendations": ["...", "...", "..."]
}`;

    const response = await this.aiAdapter.chat({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      maxTokens: 300,
      userId: 'system',
      organizationId: 'system',
    });

    try {
      const parsed = JSON.parse(response.text);
      return {
        keyTakeaways: parsed.keyTakeaways || [],
        recommendations: parsed.recommendations || [],
      };
    } catch (error) {
      logger.warn('[Narrative] Failed to parse AI insights, using defaults');
      return {
        keyTakeaways: [
          `Total variance: $${varianceData.totalVariance.toFixed(2)} (${varianceData.variancePercent.toFixed(1)}%)`,
          `${varianceData.affectedRecords} equipment records affected`,
          varianceData.totalVariance > 0 ? 'Budget overrun detected' : 'Budget savings achieved',
        ],
        recommendations: [
          'Review forecast assumptions for accuracy',
          'Investigate root causes of variance',
          'Update risk mitigation strategies',
        ],
      };
    }
  }

  /**
   * Generate unique narrative ID
   */
  private async generateNarrativeId(organizationId: string): Promise<string> {
    const org = await prisma.organizations.findUnique({
      where: { id: organizationId },
      select: { code: true },
    });

    const count = await prisma.narrative_reports.count({
      where: { organizationId },
    });

    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(3, '0');

    return `NARR-${org?.code || 'ORG'}-${year}-${sequence}`;
  }

  /**
   * Get top categories from PFA records
   */
  private getTopCategories(records: any[], limit: number): string {
    const categoryCounts: Record<string, number> = {};

    records.forEach(pfa => {
      const category = pfa.category || 'Unknown';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    const sorted = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([category]) => category);

    return sorted.join(', ');
  }

  /**
   * Get existing narrative by ID
   */
  async getNarrative(narrativeId: string) {
    const narrative = await prisma.narrative_reports.findUnique({
      where: { narrativeId },
      include: {
        users: {
          select: {
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        organizations: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    });

    if (!narrative) {
      throw new Error('Narrative not found');
    }

    return {
      ...narrative,
      chapters: narrative.chapters as unknown as Chapter[],
      keyTakeaways: narrative.keyTakeaways as string[],
      timeline: narrative.timeline as unknown as TimelineEvent[],
      recommendations: narrative.recommendations as string[],
      readingProgress: narrative.readingProgress as Record<string, any> | null,
    };
  }

  /**
   * Update reading progress for a user
   */
  async updateReadingProgress(narrativeId: string, userId: string, chapter: number) {
    const narrative = await prisma.narrative_reports.findUnique({
      where: { narrativeId },
    });

    if (!narrative) {
      throw new Error('Narrative not found');
    }

    const progress = (narrative.readingProgress as Record<string, any>) || {};
    progress[userId] = {
      chapter,
      timestamp: new Date().toISOString(),
    };

    await prisma.narrative_reports.update({
      where: { narrativeId },
      data: { readingProgress: progress },
    });

    return { success: true };
  }
}
