/**
 * BEO Analytics Service - Voice-Enabled Portfolio Query Interface
 *
 * Phase 8, Task 8.1 of ADR-005 Multi-Tenant Access Control
 * UC-21: Boardroom Voice Analyst
 *
 * Features:
 * - Natural language portfolio queries (voice/text)
 * - Executive persona detection (CFO vs. COO responses)
 * - Follow-up question context preservation
 * - <3 second response time requirement
 * - Voice-optimized output (TTS-friendly)
 */

import prisma from '../../config/database';
import { GeminiAdapter } from './GeminiAdapter';
import { modelSelector } from './ModelSelector';
import { aiResponseCache } from './AIResponseCache';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

// ============================================================================
// Types
// ============================================================================

export interface PortfolioQueryRequest {
  userId: string;
  query: string;
  responseFormat?: 'conversational' | 'structured';
  contextQueryId?: string; // For follow-up questions
}

export interface PortfolioQueryResponse {
  queryId: string;
  response: string; // Main response text
  voiceResponse?: string; // TTS-optimized version (<500 chars)
  confidence: number; // 0-1
  queryType: string; // budget_variance, equipment_status, etc.
  data?: any; // Structured data for charts (if responseFormat=structured)
  metadata: {
    organizationsAnalyzed: number;
    recordsAnalyzed: number;
    userPersona?: string;
    modelUsed: string;
    latencyMs: number;
    cached: boolean;
  };
}

export interface PortfolioMetrics {
  totalOrganizations: number;
  budgetTotal: number;
  forecastTotal: number;
  actualTotal: number;
  variance: number;
  variancePercent: number;
  byOrganization: Array<{
    orgId: string;
    orgCode: string;
    orgName: string;
    budgetTotal: number;
    forecastTotal: number;
    actualTotal: number;
    variance: number;
    variancePercent: number;
    pfaCount: number;
  }>;
}

// ============================================================================
// BEO Analytics Service
// ============================================================================

export class BeoAnalyticsService {
  private aiAdapter: GeminiAdapter | null = null;

  /**
   * Answer portfolio-level query with conversational voice interface
   */
  async answerPortfolioQuery(params: PortfolioQueryRequest): Promise<PortfolioQueryResponse> {
    const startTime = Date.now();
    const { userId, query, responseFormat = 'conversational', contextQueryId } = params;

    try {
      // 1. Check cache for similar queries
      const cacheKey = `${query}:${responseFormat}`;
      const cached = aiResponseCache.get<PortfolioQueryResponse>('beo-analytics', cacheKey);

      if (cached) {
        logger.info(`BEO Analytics cache hit for user ${userId}`);
        return cached;
      }

      // 2. Get user persona (CFO, COO, PM) from metadata
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { metadata: true, role: true },
      });

      const userPersona = this.detectPersona(user);

      // 3. Gather portfolio data (must have perm_ViewAllOrgs capability)
      const portfolioData = await this.getPortfolioMetrics(userId);

      // 4. Detect query type
      const queryType = this.detectQueryType(query);

      // 5. Get context from previous query if follow-up
      let previousContext: any = null;
      if (contextQueryId) {
        previousContext = await this.getPreviousQueryContext(contextQueryId);
      }

      // 6. Generate AI response using optimal model
      const { response, voiceResponse, confidence, modelUsed } = await this.generateAIResponse({
        query,
        queryType,
        responseFormat,
        userPersona,
        portfolioData,
        previousContext,
      });

      const latencyMs = Date.now() - startTime;

      // 7. Create response object
      const result: PortfolioQueryResponse = {
        queryId: await this.logQuery({
          userId,
          query,
          queryType,
          responseFormat,
          contextQueryId,
          userPersona,
          response,
          confidence,
          modelUsed,
          latencyMs,
        }),
        response,
        voiceResponse,
        confidence,
        queryType,
        data: responseFormat === 'structured' ? this.extractStructuredData(response, queryType) : undefined,
        metadata: {
          organizationsAnalyzed: portfolioData.totalOrganizations,
          recordsAnalyzed: portfolioData.byOrganization.reduce((sum, org) => sum + org.pfaCount, 0),
          userPersona,
          modelUsed,
          latencyMs,
          cached: false,
        },
      };

      // 8. Cache the result (5 minutes TTL for portfolio queries)
      aiResponseCache.set('beo-analytics', cacheKey, result, {
        ttlMs: 5 * 60 * 1000, // 5 minutes
        modelUsed,
        tokensSaved: 500, // Estimate
        costSaved: 0.001, // Estimate: $0.001 per query
      });

      return result;
    } catch (error) {
      logger.error('BEO Analytics query error:', error);
      throw new Error(`Portfolio query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect user persona from metadata (CFO, COO, PM)
   */
  private detectPersona(user: any): string {
    const metadata = user?.metadata as any;
    const role = user?.role?.toLowerCase() || '';
    const jobTitle = metadata?.jobTitle?.toLowerCase() || '';

    if (jobTitle.includes('cfo') || jobTitle.includes('finance') || role.includes('finance')) {
      return 'CFO';
    } else if (jobTitle.includes('coo') || jobTitle.includes('operations') || role.includes('operations')) {
      return 'COO';
    } else if (jobTitle.includes('pm') || jobTitle.includes('project manager') || role.includes('manager')) {
      return 'PM';
    }

    return 'EXECUTIVE'; // Default
  }

  /**
   * Detect query type based on keywords
   */
  private detectQueryType(query: string): string {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('over budget') || lowerQuery.includes('variance') || lowerQuery.includes('budget')) {
      return 'budget_variance';
    } else if (lowerQuery.includes('delay') || lowerQuery.includes('schedule') || lowerQuery.includes('timeline')) {
      return 'schedule_analysis';
    } else if (lowerQuery.includes('vendor') || lowerQuery.includes('rate') || lowerQuery.includes('price')) {
      return 'vendor_rates';
    } else if (lowerQuery.includes('equipment') || lowerQuery.includes('asset')) {
      return 'equipment_status';
    } else if (lowerQuery.includes('arbitrage') || lowerQuery.includes('reallocation') || lowerQuery.includes('idle')) {
      return 'arbitrage_opportunities';
    }

    return 'general';
  }

  /**
   * Get portfolio-wide metrics across all organizations
   */
  private async getPortfolioMetrics(userId: string): Promise<PortfolioMetrics> {
    // Get all organizations the user has access to
    const userOrgs = await prisma.user_organizations.findMany({
      where: {
        userId,
        // In production: Add check for perm_ViewAllOrgs capability
      },
      include: {
        organizations: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    const orgIds = userOrgs.map((uo) => uo.organizations.id);

    // Get PFA records for all organizations
    const pfaRecords = await prisma.pfa_records.findMany({
      where: {
        organizationId: { in: orgIds },
        isDiscontinued: false,
      },
      select: {
        id: true,
        organizationId: true,
        category: true,
        source: true,
        monthlyRate: true,
        purchasePrice: true,
        originalStart: true,
        originalEnd: true,
        forecastStart: true,
        forecastEnd: true,
        actualStart: true,
        actualEnd: true,
        isActualized: true,
      },
    });

    // Calculate metrics by organization
    const orgMetrics = orgIds.map((orgId) => {
      const org = userOrgs.find((uo) => uo.organizations.id === orgId)!.organizations;
      const orgRecords = pfaRecords.filter((r: any) => r.organizationId === orgId);

      const budgetTotal = orgRecords.reduce((sum: number, r: any) => sum + this.calculateCost(r, 'original'), 0);
      const forecastTotal = orgRecords.reduce((sum: number, r: any) => sum + this.calculateCost(r, 'forecast'), 0);
      const actualTotal = orgRecords.reduce((sum: number, r: any) => sum + this.calculateCost(r, 'actual'), 0);
      const variance = forecastTotal - budgetTotal;
      const variancePercent = budgetTotal > 0 ? (variance / budgetTotal) * 100 : 0;

      return {
        orgId: org.id,
        orgCode: org.code,
        orgName: org.name,
        budgetTotal,
        forecastTotal,
        actualTotal,
        variance,
        variancePercent,
        pfaCount: orgRecords.length,
      };
    });

    // Calculate totals
    const totalBudget = orgMetrics.reduce((sum, org) => sum + org.budgetTotal, 0);
    const totalForecast = orgMetrics.reduce((sum, org) => sum + org.forecastTotal, 0);
    const totalActual = orgMetrics.reduce((sum, org) => sum + org.actualTotal, 0);
    const totalVariance = totalForecast - totalBudget;
    const totalVariancePercent = totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0;

    return {
      totalOrganizations: orgIds.length,
      budgetTotal: totalBudget,
      forecastTotal: totalForecast,
      actualTotal: totalActual,
      variance: totalVariance,
      variancePercent: totalVariancePercent,
      byOrganization: orgMetrics,
    };
  }

  /**
   * Calculate cost for a PFA record (Plan, Forecast, or Actual)
   */
  private calculateCost(record: any, phase: 'original' | 'forecast' | 'actual'): number {
    const startField = phase === 'original' ? 'originalStart' : phase === 'forecast' ? 'forecastStart' : 'actualStart';
    const endField = phase === 'original' ? 'originalEnd' : phase === 'forecast' ? 'forecastEnd' : 'actualEnd';

    const start = record[startField];
    const end = record[endField];

    if (!start || !end) return 0;

    const days = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24));

    if (record.source === 'Rental' && record.monthlyRate) {
      return (days / 30.44) * record.monthlyRate;
    } else if (record.source === 'Purchase' && record.purchasePrice) {
      return record.purchasePrice;
    }

    return 0;
  }

  /**
   * Generate AI response using Gemini
   */
  private async generateAIResponse(params: {
    query: string;
    queryType: string;
    responseFormat: 'conversational' | 'structured';
    userPersona: string;
    portfolioData: PortfolioMetrics;
    previousContext?: any;
  }): Promise<{
    response: string;
    voiceResponse?: string;
    confidence: number;
    modelUsed: string;
  }> {
    const { query, queryType, responseFormat, userPersona, portfolioData, previousContext } = params;

    // Initialize AI adapter if needed
    if (!this.aiAdapter && env.GEMINI_API_KEY) {
      this.aiAdapter = new GeminiAdapter(env.GEMINI_API_KEY);
    }

    if (!this.aiAdapter) {
      throw new Error('AI adapter not available');
    }

    // Select optimal model (Gemini Flash for speed <3s requirement)
    const model = modelSelector.selectModel('beo-analytics');

    // Build context-aware prompt
    const prompt = this.buildPrompt({
      query,
      queryType,
      responseFormat,
      userPersona,
      portfolioData,
      previousContext,
    });

    // Generate response
    const aiResponse = await this.aiAdapter.chat({
      messages: [{ role: 'user', content: prompt }],
      userId: 'system',
      organizationId: 'system', // System-level query across all orgs
      temperature: 0.7, // Balanced for conversational tone
      maxTokens: responseFormat === 'conversational' ? 500 : 1000,
    });

    // Extract voice-friendly version
    const voiceResponse = this.extractVoiceResponse(aiResponse.text);

    return {
      response: aiResponse.text,
      voiceResponse,
      confidence: 0.85, // High confidence for Gemini with structured data
      modelUsed: model.model,
    };
  }

  /**
   * Build AI prompt with executive context
   */
  private buildPrompt(params: {
    query: string;
    queryType: string;
    responseFormat: 'conversational' | 'structured';
    userPersona: string;
    portfolioData: PortfolioMetrics;
    previousContext?: any;
  }): string {
    const { query, responseFormat, userPersona, portfolioData, previousContext } = params;

    let prompt = `You are a construction equipment portfolio analyst speaking to a ${userPersona}.\n\n`;

    // Add persona-specific instructions
    if (userPersona === 'CFO') {
      prompt += `**Your Audience**: Chief Financial Officer (emphasize budget, variance, financial impact)\n`;
    } else if (userPersona === 'COO') {
      prompt += `**Your Audience**: Chief Operations Officer (emphasize schedule, delays, operational issues)\n`;
    }

    prompt += `\n**Portfolio Overview**:\n`;
    prompt += `- Total Organizations: ${portfolioData.totalOrganizations}\n`;
    prompt += `- Total Budget: $${this.formatCurrency(portfolioData.budgetTotal)}\n`;
    prompt += `- Total Forecast: $${this.formatCurrency(portfolioData.forecastTotal)}\n`;
    prompt += `- Total Variance: $${this.formatCurrency(portfolioData.variance)} (${portfolioData.variancePercent.toFixed(1)}%)\n\n`;

    // Add organization breakdown
    prompt += `**By Organization**:\n`;
    portfolioData.byOrganization.forEach(org => {
      prompt += `- ${org.orgName} (${org.orgCode}): `;
      prompt += `Budget $${this.formatCurrency(org.budgetTotal)}, `;
      prompt += `Forecast $${this.formatCurrency(org.forecastTotal)}, `;
      prompt += `Variance $${this.formatCurrency(org.variance)} (${org.variancePercent.toFixed(1)}%)\n`;
    });

    // Add previous context if follow-up question
    if (previousContext) {
      prompt += `\n**Previous Question**: "${previousContext.query}"\n`;
      prompt += `**Previous Response Summary**: ${previousContext.response.substring(0, 200)}...\n\n`;
    }

    prompt += `\n**User Question**: "${query}"\n\n`;

    // Add response format instructions
    if (responseFormat === 'conversational') {
      prompt += `**Instructions**:\n`;
      prompt += `- Respond conversationally as if speaking to the ${userPersona} in person\n`;
      prompt += `- Keep response under 300 words (voice-friendly)\n`;
      prompt += `- Use "dollars" instead of "$" symbols (for text-to-speech)\n`;
      prompt += `- Be specific with numbers and organization names\n`;
      prompt += `- Provide actionable insights\n`;
    } else {
      prompt += `**Instructions**:\n`;
      prompt += `- Provide structured response with sections\n`;
      prompt += `- Include specific data points and metrics\n`;
      prompt += `- Use bullet points for clarity\n`;
    }

    return prompt;
  }

  /**
   * Extract voice-optimized response (<500 chars for TTS)
   */
  private extractVoiceResponse(text: string): string {
    // Take first 2 sentences or 500 chars, whichever is shorter
    const sentences = text.split(/[.!?]\s+/);
    let voiceText = '';

    for (const sentence of sentences) {
      if (voiceText.length + sentence.length > 450) break;
      voiceText += sentence + '. ';
    }

    // Replace $ symbols with "dollars" for TTS
    voiceText = voiceText.replace(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g, '$1 dollars');

    return voiceText.trim();
  }

  /**
   * Format currency (add commas)
   */
  private formatCurrency(amount: number): string {
    return Math.round(amount).toLocaleString();
  }

  /**
   * Extract structured data from AI response based on query type
   */
  private extractStructuredData(response: string, queryType: string): any {
    // In production: Parse response for structured data
    // For now, return basic structure
    return {
      queryType,
      summary: response.substring(0, 200),
    };
  }

  /**
   * Get previous query context for follow-up questions
   */
  private async getPreviousQueryContext(queryId: string): Promise<any | null> {
    try {
      const previousQuery = await prisma.ai_query_logs.findUnique({
        where: { id: queryId },
        select: {
          query: true,
          response: true,
          queryType: true,
        },
      });

      return previousQuery;
    } catch (error) {
      logger.warn(`Failed to retrieve previous query context: ${queryId}`, error);
      return null;
    }
  }

  /**
   * Log query to database for learning and analytics
   */
  private async logQuery(params: {
    userId: string;
    query: string;
    queryType: string;
    responseFormat: string;
    contextQueryId?: string;
    userPersona?: string;
    response: string;
    confidence: number;
    modelUsed: string;
    latencyMs: number;
  }): Promise<string> {
    try {
      const log = await prisma.ai_query_logs.create({
        data: {
          id: `query_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
          userId: params.userId,
          organizationId: 'portfolio', // Portfolio-wide query
          query: params.query,
          queryType: params.queryType,
          responseFormat: params.responseFormat,
          contextQueryId: params.contextQueryId,
          userPersona: params.userPersona,
          response: params.response,
          confidence: params.confidence,
          modelUsed: params.modelUsed,
          tokensUsed: Math.ceil(params.response.length / 4), // Estimate
          costUsd: 0.001, // Estimate
          latencyMs: params.latencyMs,
        },
      });

      return log.id;
    } catch (error) {
      logger.error('Failed to log BEO query:', error);
      return '';
    }
  }
}

// Export singleton instance
export const beoAnalyticsService = new BeoAnalyticsService();
export default beoAnalyticsService;
