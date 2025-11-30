// backend/src/services/ai/PermissionSuggestionService.ts
/**
 * AI Permission Suggestion Engine
 *
 * Phase 6, Task 6.1 of ADR-005 Multi-Tenant Access Control
 *
 * Analyzes historical permission patterns to suggest optimal permissions
 * for new user-organization assignments based on role and department.
 */

import { randomUUID } from 'crypto';
import prisma from '../../config/database';
import { GeminiAdapter } from './GeminiAdapter';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

// ============================================================================
// Types
// ============================================================================

export interface PermissionSuggestionRequest {
  userId: string;
  organizationId: string;
  role?: string; // User's job role (e.g., "Project Manager")
  department?: string; // Department (e.g., "Construction")
}

export interface SuggestedCapabilities {
  perm_Read: boolean;
  perm_EditForecast: boolean;
  perm_EditActuals: boolean;
  perm_Delete: boolean;
  perm_Import: boolean;
  perm_RefreshData: boolean;
  perm_Export: boolean;
  perm_ViewFinancials: boolean;
  perm_SaveDraft: boolean;
  perm_Sync: boolean;
  perm_ManageUsers: boolean;
  perm_ManageSettings: boolean;
  perm_ConfigureAlerts: boolean;
  perm_Impersonate: boolean;
}

export interface SecurityWarning {
  capability: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
}

export interface PermissionSuggestion {
  id?: string;
  suggestedRole: 'viewer' | 'editor' | 'admin' | 'beo' | 'member';
  suggestedCapabilities: SuggestedCapabilities;
  confidence: number; // 0-1
  reasoning: string;
  basedOnUsers: number; // How many similar users analyzed
  securityWarnings: SecurityWarning[];
}

interface PermissionStatistics {
  roleDistribution: Record<string, number>;
  capabilityFrequency: Record<string, number>;
  capabilityPercentages: Record<string, string>;
  totalUsers: number;
}

interface SimilarUserData {
  id: string;
  role: string;
  perm_Read: boolean;
  perm_EditForecast: boolean;
  perm_EditActuals: boolean;
  perm_Delete: boolean;
  perm_Import: boolean;
  perm_RefreshData: boolean;
  perm_Export: boolean;
  perm_ViewFinancials: boolean;
  perm_SaveDraft: boolean;
  perm_Sync: boolean;
  perm_ManageUsers: boolean;
  perm_ManageSettings: boolean;
  perm_ConfigureAlerts: boolean;
  perm_Impersonate: boolean;
  user: {
    id: string;
    username: string;
    role: string;
  };
  organization: {
    id: string;
    code: string;
  };
}

// ============================================================================
// Permission Suggestion Service
// ============================================================================

export class PermissionSuggestionService {
  private aiAdapter: GeminiAdapter | null = null;
  private suggestionCache = new Map<string, { suggestion: PermissionSuggestion; timestamp: number }>();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * AI-Powered Permission Suggestion Engine (Use Case #1)
   *
   * Analyzes historical permission patterns to suggest optimal permissions
   * for new user-organization assignments.
   */
  async suggestPermissions(
    request: PermissionSuggestionRequest
  ): Promise<PermissionSuggestion> {
    const startTime = Date.now();
    const cacheKey = `${request.role || 'unknown'}_${request.department || 'unknown'}_${request.organizationId}`;

    try {
      // 1. Check cache for common role/department combinations
      const cachedResult = this.suggestionCache.get(cacheKey);
      if (cachedResult && (Date.now() - cachedResult.timestamp) < this.CACHE_TTL_MS) {
        logger.info(`Permission suggestion cache hit for ${cacheKey}`);
        return {
          ...cachedResult.suggestion,
          id: await this.logSuggestion(request, cachedResult.suggestion),
        };
      }

      // 2. Gather historical data for similar users
      const similarUsers = await this.findSimilarUsers(request);

      // 3. If we have enough data, use AI for suggestion
      let suggestion: PermissionSuggestion;

      if (similarUsers.length >= 10) {
        // Calculate permission frequency distribution
        const permissionStats = this.calculatePermissionStatistics(similarUsers);

        // Build AI prompt with context and get suggestion
        suggestion = await this.getAISuggestion(request, permissionStats);
      } else {
        // Not enough data - use rule-based defaults
        suggestion = this.getRuleBasedSuggestion(request, similarUsers.length);
      }

      // 4. Add security warnings based on capabilities
      suggestion.securityWarnings = this.detectSecurityRisks(suggestion.suggestedCapabilities);

      // 5. Cache the result
      this.suggestionCache.set(cacheKey, { suggestion, timestamp: Date.now() });

      // 6. Log suggestion for future training
      const suggestionId = await this.logSuggestion(request, suggestion);

      const duration = Date.now() - startTime;
      logger.info(`Permission suggestion generated in ${duration}ms`, {
        userId: request.userId,
        organizationId: request.organizationId,
        role: request.role,
        confidence: suggestion.confidence,
        basedOnUsers: suggestion.basedOnUsers,
      });

      return {
        ...suggestion,
        id: suggestionId,
      };
    } catch (error) {
      logger.error('Permission suggestion error:', error);

      // Return low-confidence default suggestion on error
      return {
        suggestedRole: 'viewer',
        suggestedCapabilities: this.getDefaultCapabilities('viewer'),
        confidence: 0.3,
        reasoning: 'Using default viewer permissions due to system error. Please review manually.',
        basedOnUsers: 0,
        securityWarnings: [{
          capability: 'all',
          risk: 'MEDIUM',
          message: 'AI suggestion unavailable. Manual review recommended.',
        }],
      };
    }
  }

  /**
   * Find users with similar roles/departments for pattern analysis
   */
  private async findSimilarUsers(request: PermissionSuggestionRequest): Promise<SimilarUserData[]> {
    const { role, department: _department, organizationId } = request;

    // Build where clause based on available criteria
    const whereConditions: any[] = [];

    // Same organization (highest priority)
    whereConditions.push({ organizationId });

    // Query for users with similar role patterns
    const similarUsers = await prisma.user_organizations.findMany({
      where: {
        OR: whereConditions,
        // Exclude the user we're suggesting for
        NOT: { userId: request.userId },
      },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
        organizations: {
          select: {
            id: true,
            code: true,
          },
        },
      },
      take: 500, // Analyze up to 500 similar users
    });

    // Filter by role/department if provided (post-query filtering since metadata is not indexed)
    let filtered = similarUsers;

    // Additional filtering based on role patterns in user.role
    if (role) {
      // Match users with similar roles (case-insensitive partial match)
      const roleLower = role.toLowerCase();
      filtered = filtered.filter(u => {
        const userRole = u.users.role?.toLowerCase() || '';
        return userRole.includes(roleLower) ||
               roleLower.includes(userRole) ||
               this.areRolesSimilar(userRole, roleLower);
      });
    }

    return filtered as unknown as SimilarUserData[];
  }

  /**
   * Check if two roles are semantically similar
   */
  private areRolesSimilar(role1: string, role2: string): boolean {
    const roleGroups = [
      ['admin', 'administrator', 'super', 'owner'],
      ['manager', 'pm', 'project manager', 'lead'],
      ['engineer', 'developer', 'technician', 'tech'],
      ['analyst', 'beo', 'business', 'finance'],
      ['viewer', 'read', 'readonly', 'guest'],
      ['editor', 'user', 'member', 'standard'],
    ];

    for (const group of roleGroups) {
      const inRole1 = group.some(r => role1.includes(r));
      const inRole2 = group.some(r => role2.includes(r));
      if (inRole1 && inRole2) return true;
    }

    return false;
  }

  /**
   * Calculate frequency distribution of permissions across similar users
   */
  private calculatePermissionStatistics(users: SimilarUserData[]): PermissionStatistics {
    const stats: PermissionStatistics = {
      roleDistribution: {},
      capabilityFrequency: {
        perm_Read: 0,
        perm_EditForecast: 0,
        perm_EditActuals: 0,
        perm_Delete: 0,
        perm_Import: 0,
        perm_RefreshData: 0,
        perm_Export: 0,
        perm_ViewFinancials: 0,
        perm_SaveDraft: 0,
        perm_Sync: 0,
        perm_ManageUsers: 0,
        perm_ManageSettings: 0,
        perm_ConfigureAlerts: 0,
        perm_Impersonate: 0,
      },
      capabilityPercentages: {},
      totalUsers: users.length,
    };

    users.forEach((userOrg) => {
      // Count role distribution
      stats.roleDistribution[userOrg.role] =
        (stats.roleDistribution[userOrg.role] || 0) + 1;

      // Count capability frequency
      if (userOrg.perm_Read) stats.capabilityFrequency.perm_Read++;
      if (userOrg.perm_EditForecast) stats.capabilityFrequency.perm_EditForecast++;
      if (userOrg.perm_EditActuals) stats.capabilityFrequency.perm_EditActuals++;
      if (userOrg.perm_Delete) stats.capabilityFrequency.perm_Delete++;
      if (userOrg.perm_Import) stats.capabilityFrequency.perm_Import++;
      if (userOrg.perm_RefreshData) stats.capabilityFrequency.perm_RefreshData++;
      if (userOrg.perm_Export) stats.capabilityFrequency.perm_Export++;
      if (userOrg.perm_ViewFinancials) stats.capabilityFrequency.perm_ViewFinancials++;
      if (userOrg.perm_SaveDraft) stats.capabilityFrequency.perm_SaveDraft++;
      if (userOrg.perm_Sync) stats.capabilityFrequency.perm_Sync++;
      if (userOrg.perm_ManageUsers) stats.capabilityFrequency.perm_ManageUsers++;
      if (userOrg.perm_ManageSettings) stats.capabilityFrequency.perm_ManageSettings++;
      if (userOrg.perm_ConfigureAlerts) stats.capabilityFrequency.perm_ConfigureAlerts++;
      if (userOrg.perm_Impersonate) stats.capabilityFrequency.perm_Impersonate++;
    });

    // Convert counts to percentages
    stats.capabilityPercentages = Object.entries(stats.capabilityFrequency).reduce(
      (acc, [key, count]) => ({
        ...acc,
        [key]: stats.totalUsers > 0
          ? ((count / stats.totalUsers) * 100).toFixed(1) + '%'
          : '0%',
      }),
      {} as Record<string, string>
    );

    return stats;
  }

  /**
   * Get AI-powered suggestion using Gemini
   */
  private async getAISuggestion(
    request: PermissionSuggestionRequest,
    stats: PermissionStatistics
  ): Promise<PermissionSuggestion> {
    try {
      // Initialize AI adapter if not already done
      if (!this.aiAdapter && env.GEMINI_API_KEY) {
        this.aiAdapter = new GeminiAdapter(env.GEMINI_API_KEY);
      }

      if (!this.aiAdapter) {
        logger.warn('AI adapter not available, using rule-based suggestion');
        return this.getRuleBasedSuggestion(request, stats.totalUsers);
      }

      const prompt = this.buildSuggestionPrompt(request, stats);

      const response = await this.aiAdapter.chat({
        messages: [{ role: 'user', content: prompt }],
        userId: request.userId,
        organizationId: request.organizationId,
        temperature: 0.3, // Low temperature for consistency
        maxTokens: 1000,
      });

      // Parse AI response
      const suggestion = this.parseAIResponse(response.text, stats);
      return suggestion;
    } catch (error) {
      logger.error('AI suggestion generation failed:', error);
      return this.getRuleBasedSuggestion(request, stats.totalUsers);
    }
  }

  /**
   * Build AI prompt with historical data context
   */
  private buildSuggestionPrompt(
    request: PermissionSuggestionRequest,
    stats: PermissionStatistics
  ): string {
    const { role, department } = request;

    return `You are an access control expert for PFA Vanguard, a construction equipment tracking system.

**Task**: Suggest optimal permissions for a new user assignment.

**User Context**:
- Job Role: ${role || 'Unknown'}
- Department: ${department || 'Unknown'}
- Organization: Multi-tenant construction project

**Historical Permission Patterns** (${stats.totalUsers} similar users analyzed):

**Role Distribution**:
${Object.entries(stats.roleDistribution)
  .map(([role, count]) => `- ${role}: ${count} users (${((count / stats.totalUsers) * 100).toFixed(1)}%)`)
  .join('\n')}

**Permission Frequency** (% of similar users granted):
- perm_Read: ${stats.capabilityPercentages.perm_Read}
- perm_EditForecast: ${stats.capabilityPercentages.perm_EditForecast}
- perm_EditActuals: ${stats.capabilityPercentages.perm_EditActuals}
- perm_Delete: ${stats.capabilityPercentages.perm_Delete}
- perm_Import: ${stats.capabilityPercentages.perm_Import}
- perm_RefreshData: ${stats.capabilityPercentages.perm_RefreshData}
- perm_Export: ${stats.capabilityPercentages.perm_Export}
- perm_ViewFinancials: ${stats.capabilityPercentages.perm_ViewFinancials}
- perm_SaveDraft: ${stats.capabilityPercentages.perm_SaveDraft}
- perm_Sync: ${stats.capabilityPercentages.perm_Sync}
- perm_ManageUsers: ${stats.capabilityPercentages.perm_ManageUsers}
- perm_ManageSettings: ${stats.capabilityPercentages.perm_ManageSettings}
- perm_ConfigureAlerts: ${stats.capabilityPercentages.perm_ConfigureAlerts}
- perm_Impersonate: ${stats.capabilityPercentages.perm_Impersonate}

**Available Roles**:
- \`viewer\`: Read-only access (perm_Read only)
- \`member\`: Basic access (perm_Read, perm_Export)
- \`editor\`: Read + write access (perm_Read, perm_EditForecast, perm_SaveDraft, perm_Export)
- \`admin\`: Full control (all permissions except Impersonate)
- \`beo\`: Business Executive Overhead (cross-org analytics, perm_ViewFinancials)

**Your Task**:
1. Recommend a \`suggestedRole\` (viewer | member | editor | admin | beo)
2. Recommend \`suggestedCapabilities\` (all 14 permissions as true/false)
3. Provide \`reasoning\` (1-2 sentences explaining why)
4. Estimate \`confidence\` (0-1) based on data quality

**Response Format** (JSON only, no markdown):
{
  "suggestedRole": "editor",
  "suggestedCapabilities": {
    "perm_Read": true,
    "perm_EditForecast": true,
    "perm_EditActuals": false,
    "perm_Delete": false,
    "perm_Import": false,
    "perm_RefreshData": true,
    "perm_Export": true,
    "perm_ViewFinancials": false,
    "perm_SaveDraft": true,
    "perm_Sync": false,
    "perm_ManageUsers": false,
    "perm_ManageSettings": false,
    "perm_ConfigureAlerts": false,
    "perm_Impersonate": false
  },
  "confidence": 0.85,
  "reasoning": "Based on ${stats.totalUsers} similar users, most have editor-level access with forecast editing and export capabilities."
}

**Important**:
- Higher confidence (>0.9) if role/department patterns are strong
- Lower confidence (<0.7) if few similar users or conflicting patterns
- DO NOT suggest perm_ManageSettings unless >80% of similar users have it
- DO NOT suggest perm_ViewFinancials for non-BEO/admin roles unless explicitly common
- Respond with ONLY the JSON object, no other text`;
  }

  /**
   * Parse AI response to extract suggestion
   */
  private parseAIResponse(responseText: string, stats: PermissionStatistics): PermissionSuggestion {
    try {
      // Try to extract JSON from response
      let jsonStr = responseText.trim();

      // Handle markdown code blocks
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr);

      return {
        suggestedRole: parsed.suggestedRole || 'viewer',
        suggestedCapabilities: {
          perm_Read: parsed.suggestedCapabilities?.perm_Read ?? true,
          perm_EditForecast: parsed.suggestedCapabilities?.perm_EditForecast ?? false,
          perm_EditActuals: parsed.suggestedCapabilities?.perm_EditActuals ?? false,
          perm_Delete: parsed.suggestedCapabilities?.perm_Delete ?? false,
          perm_Import: parsed.suggestedCapabilities?.perm_Import ?? false,
          perm_RefreshData: parsed.suggestedCapabilities?.perm_RefreshData ?? false,
          perm_Export: parsed.suggestedCapabilities?.perm_Export ?? false,
          perm_ViewFinancials: parsed.suggestedCapabilities?.perm_ViewFinancials ?? false,
          perm_SaveDraft: parsed.suggestedCapabilities?.perm_SaveDraft ?? false,
          perm_Sync: parsed.suggestedCapabilities?.perm_Sync ?? false,
          perm_ManageUsers: parsed.suggestedCapabilities?.perm_ManageUsers ?? false,
          perm_ManageSettings: parsed.suggestedCapabilities?.perm_ManageSettings ?? false,
          perm_ConfigureAlerts: parsed.suggestedCapabilities?.perm_ConfigureAlerts ?? false,
          perm_Impersonate: parsed.suggestedCapabilities?.perm_Impersonate ?? false,
        },
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
        reasoning: parsed.reasoning || 'AI-generated suggestion based on historical patterns.',
        basedOnUsers: stats.totalUsers,
        securityWarnings: [],
      };
    } catch (error) {
      logger.error('Failed to parse AI response:', error);
      return this.getDefaultSuggestion(stats.totalUsers);
    }
  }

  /**
   * Rule-based suggestion when AI is unavailable or insufficient data
   */
  private getRuleBasedSuggestion(request: PermissionSuggestionRequest, basedOnUsers: number): PermissionSuggestion {
    const { role } = request;
    const roleLower = (role || '').toLowerCase();

    // Determine role based on keywords
    let suggestedRole: 'viewer' | 'editor' | 'admin' | 'beo' | 'member' = 'viewer';
    let capabilities = this.getDefaultCapabilities('viewer');
    let confidence = 0.6;
    let reasoning = 'Default viewer permissions. Manual review recommended.';

    if (roleLower.includes('admin') || roleLower.includes('manager')) {
      suggestedRole = 'admin';
      capabilities = this.getDefaultCapabilities('admin');
      confidence = 0.75;
      reasoning = `Role "${role}" suggests administrative access based on keyword matching.`;
    } else if (roleLower.includes('beo') || roleLower.includes('executive') || roleLower.includes('finance')) {
      suggestedRole = 'beo';
      capabilities = this.getDefaultCapabilities('beo');
      confidence = 0.7;
      reasoning = `Role "${role}" suggests BEO-level access for financial visibility.`;
    } else if (roleLower.includes('editor') || roleLower.includes('engineer') || roleLower.includes('analyst')) {
      suggestedRole = 'editor';
      capabilities = this.getDefaultCapabilities('editor');
      confidence = 0.7;
      reasoning = `Role "${role}" suggests editor access for forecast management.`;
    } else if (roleLower.includes('member') || roleLower.includes('user')) {
      suggestedRole = 'member';
      capabilities = this.getDefaultCapabilities('member');
      confidence = 0.65;
      reasoning = `Role "${role}" suggests basic member access.`;
    }

    return {
      suggestedRole,
      suggestedCapabilities: capabilities,
      confidence,
      reasoning,
      basedOnUsers,
      securityWarnings: [],
    };
  }

  /**
   * Get default capabilities for a role
   */
  private getDefaultCapabilities(role: string): SuggestedCapabilities {
    const defaults: SuggestedCapabilities = {
      perm_Read: false,
      perm_EditForecast: false,
      perm_EditActuals: false,
      perm_Delete: false,
      perm_Import: false,
      perm_RefreshData: false,
      perm_Export: false,
      perm_ViewFinancials: false,
      perm_SaveDraft: false,
      perm_Sync: false,
      perm_ManageUsers: false,
      perm_ManageSettings: false,
      perm_ConfigureAlerts: false,
      perm_Impersonate: false,
    };

    switch (role) {
      case 'admin':
        return {
          ...defaults,
          perm_Read: true,
          perm_EditForecast: true,
          perm_EditActuals: true,
          perm_Delete: true,
          perm_Import: true,
          perm_RefreshData: true,
          perm_Export: true,
          perm_ViewFinancials: true,
          perm_SaveDraft: true,
          perm_Sync: true,
          perm_ManageUsers: true,
          perm_ManageSettings: true,
          perm_ConfigureAlerts: true,
          perm_Impersonate: false, // Never auto-grant impersonate
        };
      case 'beo':
        return {
          ...defaults,
          perm_Read: true,
          perm_Export: true,
          perm_ViewFinancials: true,
          perm_ConfigureAlerts: true,
        };
      case 'editor':
        return {
          ...defaults,
          perm_Read: true,
          perm_EditForecast: true,
          perm_Export: true,
          perm_SaveDraft: true,
          perm_RefreshData: true,
        };
      case 'member':
        return {
          ...defaults,
          perm_Read: true,
          perm_Export: true,
        };
      case 'viewer':
      default:
        return {
          ...defaults,
          perm_Read: true,
        };
    }
  }

  /**
   * Get default suggestion when parsing fails
   */
  private getDefaultSuggestion(basedOnUsers: number): PermissionSuggestion {
    return {
      suggestedRole: 'viewer',
      suggestedCapabilities: this.getDefaultCapabilities('viewer'),
      confidence: 0.5,
      reasoning: 'Default viewer permissions suggested. Manual review recommended.',
      basedOnUsers,
      securityWarnings: [],
    };
  }

  /**
   * Detect security risks in suggested capabilities
   */
  private detectSecurityRisks(capabilities: SuggestedCapabilities): SecurityWarning[] {
    const warnings: SecurityWarning[] = [];

    // High risk: Financial data access
    if (capabilities.perm_ViewFinancials) {
      warnings.push({
        capability: 'perm_ViewFinancials',
        risk: 'MEDIUM',
        message: 'Grants access to cost data. Ensure user has signed NDA.',
      });
    }

    // High risk: Export with financials
    if (capabilities.perm_Export && capabilities.perm_ViewFinancials) {
      warnings.push({
        capability: 'perm_Export + perm_ViewFinancials',
        risk: 'HIGH',
        message: 'Allows exporting financial data. Requires approval from Finance department.',
      });
    }

    // Medium risk: Sync permissions
    if (capabilities.perm_Sync) {
      warnings.push({
        capability: 'perm_Sync',
        risk: 'MEDIUM',
        message: 'Allows PEMS data synchronization. User should be trained on sync workflows.',
      });
    }

    // High risk: User management
    if (capabilities.perm_ManageUsers) {
      warnings.push({
        capability: 'perm_ManageUsers',
        risk: 'HIGH',
        message: 'Grants permission to add/remove users. Requires admin approval.',
      });
    }

    // High risk: Delete permissions
    if (capabilities.perm_Delete) {
      warnings.push({
        capability: 'perm_Delete',
        risk: 'HIGH',
        message: 'Allows permanent deletion of PFA records. Use with caution.',
      });
    }

    // Critical risk: Impersonation
    if (capabilities.perm_Impersonate) {
      warnings.push({
        capability: 'perm_Impersonate',
        risk: 'CRITICAL',
        message: 'Allows user impersonation. Reserved for system administrators only.',
      });
    }

    // High risk: Settings management
    if (capabilities.perm_ManageSettings) {
      warnings.push({
        capability: 'perm_ManageSettings',
        risk: 'HIGH',
        message: 'Allows organization configuration changes. Requires senior approval.',
      });
    }

    // Medium risk: Import
    if (capabilities.perm_Import) {
      warnings.push({
        capability: 'perm_Import',
        risk: 'MEDIUM',
        message: 'Allows bulk data import. User should be trained on import procedures.',
      });
    }

    // Medium risk: Actuals editing
    if (capabilities.perm_EditActuals) {
      warnings.push({
        capability: 'perm_EditActuals',
        risk: 'MEDIUM',
        message: 'Allows editing of actualized data which may affect billing records.',
      });
    }

    return warnings;
  }

  /**
   * Log suggestion for future AI training
   */
  private async logSuggestion(
    request: PermissionSuggestionRequest,
    suggestion: PermissionSuggestion
  ): Promise<string> {
    try {
      // Note: Since the Prisma client might not be regenerated yet, this code
      // assumes the AiSuggestionLog table exists. In production, ensure
      // migrations are run and Prisma client is regenerated.

      // For now, continue using AuditLog as fallback
      const log = await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          userId: request.userId,
          organizationId: request.organizationId,
          action: 'ai_permission_suggestion',
          resource: 'user_organization',
          method: 'POST',
          success: true,
          metadata: {
            type: 'permission_suggestion',
            input: request,
            output: suggestion,
            confidence: suggestion.confidence,
            wasAccepted: false, // Will be updated if admin accepts
          } as any,
        },
      });

      return log.id;
    } catch (error) {
      logger.error('Failed to log AI suggestion:', error);
      return '';
    }
  }

  /**
   * Record suggestion acceptance/rejection for training
   */
  async recordSuggestionOutcome(
    suggestionId: string,
    accepted: boolean,
    actualPermissions?: SuggestedCapabilities
  ): Promise<void> {
    try {
      await prisma.audit_logs.update({
        where: { id: suggestionId },
        data: {
          metadata: {
            wasAccepted: accepted,
            actualOutput: actualPermissions,
            acceptedAt: new Date().toISOString(),
          } as any,
        },
      });
    } catch (error) {
      logger.error('Failed to record suggestion outcome:', error);
    }
  }

  /**
   * Get suggestion acceptance rate for quality monitoring
   */
  async getSuggestionStats(organizationId?: string): Promise<{
    totalSuggestions: number;
    acceptedCount: number;
    acceptanceRate: number;
    averageConfidence: number;
    byRole: Record<string, { total: number; accepted: number }>;
  }> {
    const where: any = {
      action: 'ai_permission_suggestion',
    };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    const suggestions = await prisma.audit_logs.findMany({
      where,
      select: {
        metadata: true,
      },
    });

    let acceptedCount = 0;
    let totalConfidence = 0;
    const byRole: Record<string, { total: number; accepted: number }> = {};

    suggestions.forEach((s: any) => {
      const metadata = s.metadata as any;
      if (metadata?.wasAccepted) acceptedCount++;
      if (metadata?.confidence) totalConfidence += metadata.confidence;

      const role = metadata?.output?.suggestedRole || 'unknown';
      if (!byRole[role]) byRole[role] = { total: 0, accepted: 0 };
      byRole[role].total++;
      if (metadata?.wasAccepted) byRole[role].accepted++;
    });

    return {
      totalSuggestions: suggestions.length,
      acceptedCount,
      acceptanceRate: suggestions.length > 0 ? acceptedCount / suggestions.length : 0,
      averageConfidence: suggestions.length > 0 ? totalConfidence / suggestions.length : 0,
      byRole,
    };
  }
}

export default new PermissionSuggestionService();
