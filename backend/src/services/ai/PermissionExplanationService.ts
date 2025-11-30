// backend/src/services/ai/PermissionExplanationService.ts
/**
 * Context-Aware Access Explanation Service
 *
 * Phase 7, Task 7.1 of ADR-005 Multi-Tenant Access Control
 * AI Use Case 16: Context-Aware Access Explanation
 *
 * Generates intelligent explanations for permission denials using:
 * - Permission chain analysis (5 checks)
 * - Google Gemini AI for human-readable explanations
 * - Rule-based fallback when AI unavailable
 * - LRU cache for fast responses (<300ms target)
 *
 * Business Value:
 * - 30% reduction in permission-related support tickets
 * - Average 15 minutes saved per incident
 * - Improved user trust through transparency
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../../utils/logger';
import { lazyAiClient } from './AiProviderHelper';

const prisma = new PrismaClient();

// ============================================================================
// Types
// ============================================================================

export interface PermissionChainCheck {
  check: string;
  result: boolean;
  reason: string;
}

export interface ResolveAction {
  action: string;
  contact: string;
  eta: string;
}

export interface PermissionExplanation {
  summary: string;
  reasons: string[];
  resolveActions: ResolveAction[];
  confidence: number;
  permissionChain: PermissionChainCheck[];
  cached: boolean;
  generationTimeMs: number;
}

export interface ExplainPermissionDenialParams {
  userId: string;
  organizationId: string;
  action: string;
}

// ============================================================================
// Simple LRU Cache Implementation
// ============================================================================

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

class SimpleLRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private ttlMs: number;

  constructor(options: { max: number; ttlMs: number }) {
    this.cache = new Map();
    this.maxSize = options.max;
    this.ttlMs = options.ttlMs;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    // Delete if exists (to update position)
    this.cache.delete(key);

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, { value, timestamp: Date.now() });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// ============================================================================
// Action Display Names
// ============================================================================

const ACTION_DISPLAY_NAMES: Record<string, string> = {
  'perm_Read': 'View Data',
  'perm_EditForecast': 'Edit Forecasts',
  'perm_EditActuals': 'Edit Actuals',
  'perm_Delete': 'Delete Records',
  'perm_Import': 'Import Data',
  'perm_RefreshData': 'Refresh Data',
  'perm_Export': 'Export Data',
  'perm_ViewFinancials': 'View Financial Details',
  'perm_SaveDraft': 'Save Drafts',
  'perm_Sync': 'Sync PEMS Data',
  'perm_ManageUsers': 'Manage Users',
  'perm_ManageSettings': 'Manage Settings',
  'perm_ConfigureAlerts': 'Configure Alerts',
  'perm_Impersonate': 'Impersonate Users',
  // Legacy action names
  'pems:sync': 'Sync PEMS Data',
  'pfa:read': 'View PFA Records',
  'pfa:update': 'Modify PFA Records',
  'pfa:delete': 'Delete PFA Records',
  'settings:manage': 'Manage Settings',
  'users:manage': 'Manage Users',
  'financials:view': 'View Financial Details',
};

// ============================================================================
// PermissionExplanationService
// ============================================================================

export class PermissionExplanationService {
  private cache: SimpleLRUCache<PermissionExplanation>;

  constructor() {
    // Cache explanations for 15 minutes (permission changes are infrequent)
    this.cache = new SimpleLRUCache<PermissionExplanation>({
      max: 1000,
      ttlMs: 1000 * 60 * 15, // 15 minutes
    });
    // AI client is lazily loaded from database-configured providers
  }

  /**
   * Get AI client (lazy-loaded from database-configured providers)
   */
  private async getAiClient(): Promise<GoogleGenerativeAI | null> {
    return lazyAiClient.getClient();
  }

  /**
   * Explain why a user is denied permission for a specific action
   *
   * @returns PermissionExplanation if denied, null if allowed
   */
  async explainPermissionDenial(
    params: ExplainPermissionDenialParams
  ): Promise<PermissionExplanation | null> {
    const { userId, organizationId, action } = params;
    const startTime = Date.now();

    // Check cache first (permission chains are deterministic)
    const cacheKey = `${userId}:${organizationId}:${action}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      logger.debug(`[PermissionExplanation] Cache hit for ${cacheKey}`);
      return { ...cached, cached: true };
    }

    // Analyze permission chain (5 checks)
    const permissionChain = await this.analyzePermissionChain(params);

    // If all checks pass, user has permission (no explanation needed)
    const allPassed = permissionChain.every(c => c.result);
    if (allPassed) {
      return null; // No denial to explain
    }

    // Generate explanation for failed checks
    let explanation: PermissionExplanation;

    const genAI = await this.getAiClient();
    if (genAI) {
      try {
        explanation = await this.generateAIExplanation({
          userId,
          organizationId,
          action,
          permissionChain,
          genAI,
        });
      } catch (error) {
        logger.error('[PermissionExplanation] AI generation failed, using fallback:', error);
        explanation = this.generateFallbackExplanation({
          action,
          permissionChain,
        });
      }
    } else {
      explanation = this.generateFallbackExplanation({
        action,
        permissionChain,
      });
    }

    // Add generation time and cache status
    explanation.generationTimeMs = Date.now() - startTime;
    explanation.cached = false;

    // Cache explanation
    this.cache.set(cacheKey, explanation);

    return explanation;
  }

  /**
   * Analyze the permission chain for a given action
   * Returns array of 5 checks (user status, org status, role capability, override, resource lock)
   */
  private async analyzePermissionChain(
    params: ExplainPermissionDenialParams
  ): Promise<PermissionChainCheck[]> {
    const { userId, organizationId, action } = params;

    // Fetch user, org, and user-org relationship
    const [user, org, userOrg] = await Promise.all([
      prisma.users.findUnique({ where: { id: userId } }),
      prisma.organizations.findUnique({ where: { id: organizationId } }),
      prisma.user_organizations.findUnique({
        where: {
          userId_organizationId: { userId, organizationId },
        },
      }),
    ]);

    const chain: PermissionChainCheck[] = [];

    // Check 1: User is active (not suspended or locked)
    if (user) {
      chain.push({
        check: 'User is active',
        result: user.serviceStatus === 'active' && user.isActive,
        reason: user.serviceStatus === 'active' && user.isActive
          ? 'User status: active'
          : `User status: ${user.serviceStatus}${user.isActive ? '' : ' (inactive)'}`,
      });
    } else {
      chain.push({
        check: 'User is active',
        result: false,
        reason: 'User not found',
      });
    }

    // Check 2: Organization is active (not suspended or archived)
    if (org) {
      chain.push({
        check: 'Organization is active',
        result: org.serviceStatus === 'active' && org.isActive,
        reason: org.serviceStatus === 'active' && org.isActive
          ? 'Organization status: active'
          : `Organization status: ${org.serviceStatus}${org.serviceStatus === 'suspended' ? ' (payment overdue or admin action)' : ''}`,
      });
    } else {
      chain.push({
        check: 'Organization is active',
        result: false,
        reason: 'Organization not found',
      });
    }

    // Check 3: User has required capability (from role/direct assignment)
    // Map action to permission field name
    const permissionField = this.mapActionToPermissionField(action);

    if (userOrg && permissionField) {
      const hasCapability = (userOrg as any)[permissionField] === true;
      chain.push({
        check: `User has ${this.getActionDisplayName(action)} capability`,
        result: hasCapability,
        reason: hasCapability
          ? `${userOrg.role} role includes ${permissionField}`
          : `${userOrg.role} role does not include ${permissionField}`,
      });
    } else if (!userOrg) {
      chain.push({
        check: `User has ${this.getActionDisplayName(action)} capability`,
        result: false,
        reason: 'User has no assignment to this organization',
      });
    } else {
      chain.push({
        check: `User has ${this.getActionDisplayName(action)} capability`,
        result: false,
        reason: `Unknown action: ${action}`,
      });
    }

    // Check 4: Check if user has custom capability grant (isCustom flag indicates overrides)
    if (userOrg) {
      chain.push({
        check: 'Capability override check',
        result: true, // For now, pass if user-org exists
        reason: userOrg.isCustom
          ? 'User has custom permission overrides'
          : 'No custom overrides (using role defaults)',
      });
    } else {
      chain.push({
        check: 'Capability override check',
        result: true,
        reason: 'No custom overrides configured',
      });
    }

    // Check 5: Resource-specific lock (future enhancement)
    // For now, always pass (no resource locks implemented yet)
    chain.push({
      check: 'Resource lock check',
      result: true,
      reason: 'No resource-specific locks',
    });

    return chain;
  }

  /**
   * Generate AI explanation using Google Gemini
   */
  private async generateAIExplanation(params: {
    userId: string;
    organizationId: string;
    action: string;
    permissionChain: PermissionChainCheck[];
    genAI: GoogleGenerativeAI;
  }): Promise<PermissionExplanation> {
    const { userId, organizationId, action, permissionChain, genAI } = params;

    // Fetch user and org details for context
    const [user, org, userOrg] = await Promise.all([
      prisma.users.findUnique({
        where: { id: userId },
        select: { username: true, firstName: true, lastName: true },
      }),
      prisma.organizations.findUnique({
        where: { id: organizationId },
        select: { name: true, code: true },
      }),
      prisma.user_organizations.findUnique({
        where: { userId_organizationId: { userId, organizationId } },
        select: { role: true },
      }),
    ]);

    const actionDisplayName = this.getActionDisplayName(action);

    // Build AI prompt
    const prompt = `
You are a helpful assistant explaining permission restrictions to a construction equipment manager.

User Context:
- Username: ${user?.username || 'Unknown'}
- Role: ${userOrg?.role || 'No role assigned'}
- Organization: ${org?.name || 'Unknown'} (${org?.code || ''})

Permission Chain Analysis (5 checks performed):
${permissionChain.map((c, i) => `
  ${i + 1}. ${c.check}: ${c.result ? '✅ PASS' : '❌ FAIL'}
     Reason: ${c.reason}
`).join('\n')}

Action Attempted: ${actionDisplayName}

Instructions:
1. Explain in 2-3 sentences WHY the user cannot perform this action
2. List ACTIONABLE steps to resolve (contact admin, request role upgrade, etc.)
3. Estimate time to resolution (1 hour, 1 day, 1 week)
4. Use friendly, non-technical language
5. NEVER expose sensitive data (costs, internal IDs, admin emails)
6. If multiple checks failed, prioritize the most actionable one
7. Use "your organization administrator" instead of specific email addresses

Output Format (JSON):
{
  "summary": "Short explanation (1 sentence)",
  "reasons": ["Reason 1", "Reason 2"],
  "resolveActions": [
    { "action": "Request role upgrade", "contact": "your organization administrator", "eta": "1 business day" }
  ],
  "confidence": 0.95
}
`;

    // Call Google Gemini AI
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON response (remove markdown code fences if present)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI did not return valid JSON');
    }

    const aiResponse = JSON.parse(jsonMatch[0]);

    // Validate AI response
    if (!this.validateAIResponse(aiResponse)) {
      throw new Error('AI response validation failed');
    }

    return {
      summary: aiResponse.summary,
      reasons: aiResponse.reasons,
      resolveActions: aiResponse.resolveActions,
      confidence: aiResponse.confidence,
      permissionChain,
      cached: false,
      generationTimeMs: 0,
    };
  }

  /**
   * Validate AI response schema
   */
  private validateAIResponse(response: any): boolean {
    if (!response || typeof response !== 'object') return false;
    if (!response.summary || typeof response.summary !== 'string') return false;
    if (!Array.isArray(response.reasons)) return false;
    if (!Array.isArray(response.resolveActions)) return false;
    if (typeof response.confidence !== 'number') return false;
    if (response.confidence < 0 || response.confidence > 1) return false;

    // Validate resolve actions
    for (const action of response.resolveActions) {
      if (!action.action || !action.contact || !action.eta) return false;
    }

    return true;
  }

  /**
   * Fallback explanation if AI service unavailable
   */
  private generateFallbackExplanation(params: {
    action: string;
    permissionChain: PermissionChainCheck[];
  }): PermissionExplanation {
    const { action, permissionChain } = params;

    // Find first failed check
    const firstFailure = permissionChain.find(c => !c.result);
    const actionDisplayName = this.getActionDisplayName(action);

    if (!firstFailure) {
      return {
        summary: 'Permission denied',
        reasons: ['Unable to determine reason. Contact your administrator.'],
        resolveActions: [
          { action: 'Contact your organization administrator for assistance', contact: 'your organization administrator', eta: '1 business day' },
        ],
        confidence: 0.5,
        permissionChain,
        cached: false,
        generationTimeMs: 0,
      };
    }

    // Rule-based explanation
    const summary = `You cannot ${actionDisplayName.toLowerCase()} because ${firstFailure.reason.toLowerCase()}.`;
    const reasons = [firstFailure.reason];
    const resolveActions = this.generateFallbackActions(firstFailure);

    return {
      summary,
      reasons,
      resolveActions,
      confidence: 0.75, // Rule-based has medium confidence
      permissionChain,
      cached: false,
      generationTimeMs: 0,
    };
  }

  /**
   * Generate fallback actions based on failure type
   */
  private generateFallbackActions(failure: PermissionChainCheck): ResolveAction[] {
    if (failure.check.includes('User is active')) {
      return [
        { action: 'Contact administrator to reactivate account', contact: 'your organization administrator', eta: '1 business day' },
      ];
    }

    if (failure.check.includes('Organization is active')) {
      return [
        { action: 'Contact billing department to reactivate organization', contact: 'billing department', eta: '2-3 business days' },
      ];
    }

    if (failure.check.includes('capability') || failure.check.includes('Capability')) {
      return [
        { action: 'Request role upgrade or capability grant from administrator', contact: 'your organization administrator', eta: '1 business day' },
      ];
    }

    if (failure.check.includes('assignment') || failure.check.includes('no assignment')) {
      return [
        { action: 'Request access to this organization', contact: 'your organization administrator', eta: '1 business day' },
      ];
    }

    return [
      { action: 'Contact your organization administrator for assistance', contact: 'your organization administrator', eta: '1 business day' },
    ];
  }

  /**
   * Convert action key to human-readable name
   */
  private getActionDisplayName(action: string): string {
    return ACTION_DISPLAY_NAMES[action] || action.replace('perm_', '').replace(/([A-Z])/g, ' $1').trim();
  }

  /**
   * Map action/capability to permission field name
   */
  private mapActionToPermissionField(action: string): string | null {
    // If action already starts with perm_, use it directly
    if (action.startsWith('perm_')) {
      return action;
    }

    // Map legacy action names to permission fields
    const actionToPermField: Record<string, string> = {
      'pems:sync': 'perm_Sync',
      'pfa:read': 'perm_Read',
      'pfa:update': 'perm_EditForecast',
      'pfa:delete': 'perm_Delete',
      'settings:manage': 'perm_ManageSettings',
      'users:manage': 'perm_ManageUsers',
      'financials:view': 'perm_ViewFinancials',
    };

    return actionToPermField[action] || null;
  }

  /**
   * Clear explanation cache (for testing or after permission changes)
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('[PermissionExplanation] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: 1000,
    };
  }

  /**
   * Invalidate cache for a specific user-org-action combination
   */
  invalidateCache(userId: string, organizationId: string, _action?: string): void {
    // Since SimpleLRUCache doesn't support pattern matching, we clear the whole cache
    // In a production system, you would use a more sophisticated cache implementation
    this.cache.clear();
    logger.info(`[PermissionExplanation] Cache invalidated for user ${userId} in org ${organizationId}`);
  }
}

// Export singleton instance
const permissionExplanationService = new PermissionExplanationService();
export default permissionExplanationService;
