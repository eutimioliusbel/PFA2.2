// backend/src/services/ai/PromptTemplateManager.ts
/**
 * Prompt Template Manager
 *
 * Phase 9, Task 9.2 of ADR-005 Multi-Tenant Access Control
 * Manages and optimizes AI prompt templates
 *
 * Features:
 * - Template registry with version control
 * - Variable interpolation
 * - Prompt optimization strategies
 * - Token counting and budget management
 * - A/B testing support for prompts
 */

import { logger } from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface PromptTemplate {
  id: string;
  name: string;
  version: string;
  useCase: string;
  systemPrompt: string;
  userPromptTemplate: string;
  outputFormat: 'json' | 'text' | 'markdown';
  expectedTokens: {
    systemPrompt: number;
    userPrompt: number; // Average, before interpolation
    output: number;
  };
  variables: string[];
  examples?: Array<{
    input: Record<string, any>;
    output: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface InterpolatedPrompt {
  systemPrompt: string;
  userPrompt: string;
  estimatedTokens: number;
  templateId: string;
  templateVersion: string;
}

export interface TokenBudget {
  maxInputTokens: number;
  maxOutputTokens: number;
  reserveTokens: number; // For safety margin
}

// ============================================================================
// Default Prompt Templates
// ============================================================================

const DEFAULT_TEMPLATES: Omit<PromptTemplate, 'createdAt' | 'updatedAt'>[] = [
  // UC-16: Permission Explanation
  {
    id: 'permission-explanation-v1',
    name: 'Permission Denial Explanation',
    version: '1.0.0',
    useCase: 'permission-explanation',
    systemPrompt: `You are a helpful assistant explaining permission restrictions to a construction equipment manager.

RULES:
- Use friendly, non-technical language
- Focus on actionable resolution steps
- NEVER expose sensitive data (costs, internal IDs, admin emails)
- Use "your organization administrator" instead of specific email addresses
- Keep explanations concise (2-3 sentences max)`,
    userPromptTemplate: `User Context:
- Username: {{username}}
- Role: {{role}}
- Organization: {{organizationName}} ({{organizationCode}})

Permission Chain Analysis:
{{permissionChain}}

Action Attempted: {{actionDisplayName}}

Explain WHY the user cannot perform this action and provide ACTIONABLE steps to resolve.

Output Format (JSON):
{
  "summary": "Short explanation (1 sentence)",
  "reasons": ["Reason 1", "Reason 2"],
  "resolveActions": [
    { "action": "Request role upgrade", "contact": "your organization administrator", "eta": "1 business day" }
  ],
  "confidence": 0.95
}`,
    outputFormat: 'json',
    expectedTokens: {
      systemPrompt: 150,
      userPrompt: 200,
      output: 150,
    },
    variables: ['username', 'role', 'organizationName', 'organizationCode', 'permissionChain', 'actionDisplayName'],
    isActive: true,
  },

  // UC-17: Financial Masking Insight
  {
    id: 'financial-masking-insight-v1',
    name: 'Financial Impact Insight',
    version: '1.0.0',
    useCase: 'financial-masking',
    systemPrompt: `You are a cost optimization advisor for construction equipment. Your role is to provide actionable insights without revealing specific dollar amounts.

RULES:
- NEVER mention specific dollar amounts
- Focus on relative comparisons and percentiles
- Provide one specific, actionable optimization suggestion
- Keep response under 50 words`,
    userPromptTemplate: `Equipment Context:
- Description: {{description}}
- Category: {{category}}
- Source: {{source}} (Rental or Purchase)
- Duration: {{duration}} days
- Budget Impact: Top {{impactRank}}% ({{impactLevel}} impact)

Cost Analysis:
- This item is {{relativeComparison}}
- Percentile: {{percentile}}th within category

Provide a brief insight explaining WHY this equipment has high budget impact and suggest ONE actionable optimization.`,
    outputFormat: 'text',
    expectedTokens: {
      systemPrompt: 100,
      userPrompt: 150,
      output: 80,
    },
    variables: ['description', 'category', 'source', 'duration', 'impactRank', 'impactLevel', 'relativeComparison', 'percentile'],
    isActive: true,
  },

  // UC-18: Semantic Audit Search
  {
    id: 'semantic-audit-search-v1',
    name: 'Audit Log Query Parser',
    version: '1.0.0',
    useCase: 'semantic-audit-search',
    systemPrompt: `You are an expert at translating natural language queries into structured database filters for audit logs.

AVAILABLE FILTERS:
- resourceType: User, Organization, PfaRecord, ApiConfiguration, UserOrganization
- action: pfa:create, pfa:update, pfa:delete, permission:grant, permission:revoke, sync:start, sync:complete, auth:login, auth:logout
- userId: User ID (GUID)
- timeRange: { start: ISO date, end: ISO date }
- changedFields: Array of field names (forecastStart, forecastEnd, duration, cost, etc.)
- category: Equipment category (Cranes, Generators, Trucks, etc.)

TIME REFERENCES:
- "today" = current date
- "yesterday" = previous day
- "last week" = past 7 days
- "last month" = past 30 days
- "in November" = 2025-11-01 to 2025-11-30

OUTPUT RULES:
- Return valid JSON only
- Include confidence score (0-1)
- Provide natural language interpretation
- Mark clarificationNeeded if query is ambiguous`,
    userPromptTemplate: `Query: "{{query}}"

{{#if previousContext}}
Previous Query Context:
{{previousContext}}
{{/if}}

Parse this natural language query into structured filters.

Output Format (JSON):
{
  "filters": {
    "resourceType": "PfaRecord",
    "action": ["pfa:update"],
    "timeRange": { "start": "2025-11-20", "end": "2025-11-27" },
    "changedFields": ["forecastEnd"],
    "category": ["Cranes"]
  },
  "confidence": 0.85,
  "interpretation": "Looking for PFA record updates to crane forecast end dates in the last week",
  "clarificationNeeded": false,
  "suggestions": []
}`,
    outputFormat: 'json',
    expectedTokens: {
      systemPrompt: 250,
      userPrompt: 150,
      output: 200,
    },
    variables: ['query', 'previousContext'],
    isActive: true,
  },

  // UC-19: Role Drift Analysis
  {
    id: 'role-drift-analysis-v1',
    name: 'Role Drift Pattern Analyzer',
    version: '1.0.0',
    useCase: 'role-drift-detection',
    systemPrompt: `You are an access control analyst identifying role drift patterns in enterprise systems.

DRIFT TYPES:
- CONSISTENT_OVERRIDES: 3+ users with same override pattern
- EXCESSIVE_OVERRIDES: Single user with >5 custom overrides
- ROLE_MISMATCH: User's actual usage doesn't match assigned role

ANALYSIS GOALS:
- Identify patterns that suggest need for new role template
- Recommend normalization strategies
- Prioritize by impact (number of users affected)`,
    userPromptTemplate: `Organization: {{organizationName}}
Total Users Analyzed: {{totalUsers}}

Override Patterns Detected:
{{overridePatterns}}

For each pattern, analyze:
1. Is this a candidate for a new role template?
2. What should the new role be named?
3. What capabilities should it inherit?
4. Severity (LOW/MEDIUM/HIGH)

Output Format (JSON):
{
  "recommendations": [
    {
      "patternId": "pattern-1",
      "action": "CREATE_NEW_ROLE",
      "suggestedRoleName": "Senior Field Engineer",
      "inheritsFrom": "Field Engineer",
      "additionalCapabilities": ["canManageUsers"],
      "severity": "HIGH",
      "reasoning": "5 field engineers consistently need user management"
    }
  ]
}`,
    outputFormat: 'json',
    expectedTokens: {
      systemPrompt: 200,
      userPrompt: 300,
      output: 250,
    },
    variables: ['organizationName', 'totalUsers', 'overridePatterns'],
    isActive: true,
  },

  // UC-20: Notification Routing
  {
    id: 'notification-routing-v1',
    name: 'Smart Notification Router',
    version: '1.0.0',
    useCase: 'notification-routing',
    systemPrompt: `You are a notification optimization assistant that routes alerts based on user engagement patterns.

ROUTING OPTIONS:
- SEND_NOW: Urgent notifications or during peak hours
- DEFER: Routine notifications during quiet hours
- BATCH_DIGEST: Non-urgent items for daily/weekly summary

CHANNELS:
- slack: Real-time, high visibility
- email: Formal, searchable record
- in_app: Low interruption, user checks when ready

Consider user's historical engagement patterns when routing.`,
    userPromptTemplate: `User Engagement Profile:
- Peak Attention Hours: {{peakHours}}
- Quiet Hours: {{quietHours}}
- Preferred Channel (Urgent): {{urgentChannel}}
- Preferred Channel (Routine): {{routineChannel}}
- Current Saturation: {{saturationStatus}}

Notification:
- Type: {{notificationType}}
- Urgency: {{urgency}}
- Title: {{title}}
- Current Time: {{currentTime}}

Determine optimal routing for this notification.

Output Format (JSON):
{
  "action": "SEND_NOW" | "DEFER" | "BATCH_DIGEST",
  "channel": "slack" | "email" | "in_app",
  "deferUntil": null | "2025-11-28T14:00:00Z",
  "reasoning": "User is in peak attention hours, sending via preferred channel",
  "priority": 7
}`,
    outputFormat: 'json',
    expectedTokens: {
      systemPrompt: 150,
      userPrompt: 200,
      output: 100,
    },
    variables: ['peakHours', 'quietHours', 'urgentChannel', 'routineChannel', 'saturationStatus', 'notificationType', 'urgency', 'title', 'currentTime'],
    isActive: true,
  },
];

// ============================================================================
// PromptTemplateManager Class
// ============================================================================

export class PromptTemplateManager {
  private templates: Map<string, PromptTemplate> = new Map();
  private templatesByUseCase: Map<string, PromptTemplate[]> = new Map();

  constructor() {
    // Initialize with default templates
    this.initializeDefaultTemplates();
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): PromptTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Get active template for use case
   */
  getActiveTemplate(useCase: string): PromptTemplate | undefined {
    const templates = this.templatesByUseCase.get(useCase);
    if (!templates) return undefined;

    return templates.find(t => t.isActive);
  }

  /**
   * Interpolate template with variables
   */
  interpolate(templateId: string, variables: Record<string, any>): InterpolatedPrompt | null {
    const template = this.templates.get(templateId);
    if (!template) {
      logger.warn(`Template not found: ${templateId}`);
      return null;
    }

    // Interpolate user prompt
    let userPrompt = template.userPromptTemplate;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const stringValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      userPrompt = userPrompt.split(placeholder).join(stringValue);
    }

    // Handle conditional blocks {{#if var}}...{{/if}}
    userPrompt = this.processConditionals(userPrompt, variables);

    // Estimate tokens (rough: 1 token ~ 4 characters)
    const estimatedTokens = Math.ceil(
      (template.systemPrompt.length + userPrompt.length) / 4
    ) + template.expectedTokens.output;

    return {
      systemPrompt: template.systemPrompt,
      userPrompt,
      estimatedTokens,
      templateId: template.id,
      templateVersion: template.version,
    };
  }

  /**
   * Interpolate by use case (gets active template)
   */
  interpolateByUseCase(useCase: string, variables: Record<string, any>): InterpolatedPrompt | null {
    const template = this.getActiveTemplate(useCase);
    if (!template) {
      logger.warn(`No active template for use case: ${useCase}`);
      return null;
    }

    return this.interpolate(template.id, variables);
  }

  /**
   * Register a new template
   */
  registerTemplate(template: Omit<PromptTemplate, 'createdAt' | 'updatedAt'>): void {
    const fullTemplate: PromptTemplate = {
      ...template,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.templates.set(template.id, fullTemplate);

    // Update use case index
    const existing = this.templatesByUseCase.get(template.useCase) || [];
    existing.push(fullTemplate);
    this.templatesByUseCase.set(template.useCase, existing);

    logger.info(`Registered template: ${template.id} (${template.name})`);
  }

  /**
   * Update template
   */
  updateTemplate(templateId: string, updates: Partial<PromptTemplate>): boolean {
    const template = this.templates.get(templateId);
    if (!template) {
      return false;
    }

    const updated = {
      ...template,
      ...updates,
      updatedAt: new Date(),
    };

    this.templates.set(templateId, updated);

    // Update use case index
    const templates = this.templatesByUseCase.get(template.useCase) || [];
    const idx = templates.findIndex(t => t.id === templateId);
    if (idx >= 0) {
      templates[idx] = updated;
    }

    logger.info(`Updated template: ${templateId}`);
    return true;
  }

  /**
   * Deactivate template
   */
  deactivateTemplate(templateId: string): boolean {
    return this.updateTemplate(templateId, { isActive: false });
  }

  /**
   * Activate template
   */
  activateTemplate(templateId: string): boolean {
    const template = this.templates.get(templateId);
    if (!template) return false;

    // Deactivate other templates for same use case
    const templates = this.templatesByUseCase.get(template.useCase) || [];
    for (const t of templates) {
      if (t.id !== templateId && t.isActive) {
        this.updateTemplate(t.id, { isActive: false });
      }
    }

    return this.updateTemplate(templateId, { isActive: true });
  }

  /**
   * Get all templates
   */
  getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by use case
   */
  getTemplatesForUseCase(useCase: string): PromptTemplate[] {
    return this.templatesByUseCase.get(useCase) || [];
  }

  /**
   * Estimate tokens for a prompt
   */
  estimateTokens(text: string): number {
    // Rough estimation: 1 token ~ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if prompt fits within budget
   */
  checkTokenBudget(prompt: InterpolatedPrompt, budget: TokenBudget): {
    fits: boolean;
    inputTokens: number;
    remainingBudget: number;
  } {
    const inputTokens = this.estimateTokens(prompt.systemPrompt + prompt.userPrompt);
    const fits = inputTokens <= budget.maxInputTokens - budget.reserveTokens;

    return {
      fits,
      inputTokens,
      remainingBudget: budget.maxInputTokens - inputTokens - budget.reserveTokens,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private initializeDefaultTemplates(): void {
    for (const template of DEFAULT_TEMPLATES) {
      this.registerTemplate(template);
    }
    logger.info(`Initialized ${DEFAULT_TEMPLATES.length} default prompt templates`);
  }

  private processConditionals(text: string, variables: Record<string, any>): string {
    // Simple conditional processing: {{#if var}}content{{/if}}
    const ifRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

    return text.replace(ifRegex, (_match, varName, content) => {
      const value = variables[varName];
      if (value && value !== '' && value !== false && value !== null && value !== undefined) {
        return content;
      }
      return '';
    });
  }
}

// Export singleton instance
export const promptTemplateManager = new PromptTemplateManager();

export default promptTemplateManager;
