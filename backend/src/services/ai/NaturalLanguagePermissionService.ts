// backend/src/services/ai/NaturalLanguagePermissionService.ts
/**
 * AI Natural Language Permission Queries Service (LLM-Powered)
 *
 * Phase 6, Task 6.4 of ADR-005 Multi-Tenant Access Control
 *
 * Enables natural language queries about permissions using Google Gemini AI:
 * - "Who can delete records in HOLNG?"
 * - "What can John do?"
 * - "Show me all users with financial access"
 * - "Which users have admin rights across multiple organizations?"
 *
 * CRITICAL: Uses LLM for semantic understanding (>70% confidence required)
 */

import prisma from '../../config/database';
import { GeminiAdapter } from './GeminiAdapter';
import { logger } from '../../utils/logger';

// Minimum confidence threshold for query parsing (as per ADR-005 requirements)
const MIN_CONFIDENCE_THRESHOLD = 0.70;

// ============================================================================
// Types
// ============================================================================

export interface PermissionQueryRequest {
  query: string;
  organizationId?: string;
  userId: string; // The user making the query
}

export interface PermissionQueryResult {
  success: boolean;
  queryType: 'user_permissions' | 'org_permissions' | 'capability_search' | 'cross_org_analysis' | 'unknown';
  response: string;
  data: any;
  confidence?: number; // AI confidence score (0-1)
  parsingMethod?: 'llm' | 'regex' | 'fallback'; // How query was parsed
  structuredAnswer?: {
    users?: Array<{
      id: string;
      username: string;
      email?: string;
      permissions: string[];
      organizations: string[];
    }>;
    organizations?: Array<{
      id: string;
      code: string;
      name: string;
      userCount: number;
    }>;
    capabilities?: string[];
    summary?: string;
  };
  suggestedFollowUps?: string[];
  lowConfidenceWarning?: string; // Warning message if confidence is below threshold
}

interface QueryIntent {
  type: 'user_permissions' | 'org_permissions' | 'capability_search' | 'cross_org_analysis' | 'unknown';
  targetUser?: string;
  targetOrganization?: string;
  targetCapability?: string;
  filters: {
    hasFinancialAccess?: boolean;
    hasAdminAccess?: boolean;
    multiOrg?: boolean;
    specificPermissions?: string[];
  };
  confidence: number; // AI confidence in intent classification (0-1)
  parsingMethod: 'llm' | 'regex' | 'fallback';
  llmReasoning?: string; // AI's explanation of how it classified the query
}

// ============================================================================
// Permission Name Mappings
// ============================================================================

const PERMISSION_ALIASES: Record<string, string[]> = {
  perm_Read: ['read', 'view', 'see', 'access', 'look'],
  perm_EditForecast: ['edit forecast', 'modify forecast', 'change forecast', 'update forecast', 'edit', 'modify'],
  perm_EditActuals: ['edit actuals', 'modify actuals', 'change actuals'],
  perm_Delete: ['delete', 'remove', 'destroy', 'erase'],
  perm_Import: ['import', 'upload', 'bulk import', 'csv import'],
  perm_RefreshData: ['refresh', 'reload', 'sync data', 'update data'],
  perm_Export: ['export', 'download', 'csv export', 'extract'],
  perm_ViewFinancials: ['financial', 'financials', 'costs', 'cost data', 'rates', 'prices', 'money'],
  perm_SaveDraft: ['save draft', 'draft', 'save changes'],
  perm_Sync: ['sync', 'synchronize', 'pems sync', 'push to pems'],
  perm_ManageUsers: ['manage users', 'user management', 'add users', 'remove users', 'admin users'],
  perm_ManageSettings: ['settings', 'configuration', 'configure', 'manage settings'],
  perm_ConfigureAlerts: ['alerts', 'notifications', 'configure alerts'],
  perm_Impersonate: ['impersonate', 'act as', 'login as'],
};

const ROLE_ALIASES: Record<string, string[]> = {
  admin: ['admin', 'administrator', 'full access', 'super user', 'superuser'],
  editor: ['editor', 'write access', 'can edit'],
  viewer: ['viewer', 'read only', 'readonly', 'view only'],
  beo: ['beo', 'business executive', 'executive', 'financial analyst'],
  member: ['member', 'basic', 'standard'],
};

// ============================================================================
// Natural Language Permission Service
// ============================================================================

export class NaturalLanguagePermissionService {
  private aiAdapter: GeminiAdapter | null = null;

  /**
   * Initialize the Gemini adapter (lazy initialization)
   */
  private async getAiAdapter(): Promise<GeminiAdapter | null> {
    if (this.aiAdapter) {
      return this.aiAdapter;
    }

    try {
      // Fetch Gemini API key from database
      const geminiProvider = await prisma.ai_providers.findFirst({
        where: { type: 'gemini', enabled: true },
      });

      if (!geminiProvider || !geminiProvider.apiKeyEncrypted) {
        logger.warn('Gemini provider not configured. Falling back to regex-based parsing.');
        return null;
      }

      // Decrypt API key
      const { decrypt } = await import('../../utils/encryption');
      const apiKey = decrypt(geminiProvider.apiKeyEncrypted);

      this.aiAdapter = new GeminiAdapter(
        apiKey,
        geminiProvider.defaultModel,
        {
          input: geminiProvider.pricingInput,
          output: geminiProvider.pricingOutput,
        }
      );

      return this.aiAdapter;
    } catch (error) {
      logger.error('Failed to initialize Gemini adapter:', error);
      return null;
    }
  }

  /**
   * Process a natural language permission query
   */
  async processQuery(request: PermissionQueryRequest): Promise<PermissionQueryResult> {
    const startTime = Date.now();

    try {
      // 1. Parse the query intent using LLM or fallback to regex
      const intent = await this.parseQueryIntentWithLLM(request.query);

      // 2. Check confidence threshold
      if (intent.confidence < MIN_CONFIDENCE_THRESHOLD) {
        return this.handleLowConfidenceQuery(intent, request.query);
      }

      // 3. Execute the appropriate query based on intent
      let result: PermissionQueryResult;

      switch (intent.type) {
        case 'user_permissions':
          result = await this.queryUserPermissions(intent, request);
          break;
        case 'org_permissions':
          result = await this.queryOrganizationPermissions(intent, request);
          break;
        case 'capability_search':
          result = await this.queryByCapability(intent, request);
          break;
        case 'cross_org_analysis':
          result = await this.queryCrossOrgAnalysis(intent, request);
          break;
        default:
          result = await this.handleUnknownQuery(request);
      }

      // 4. Add confidence and parsing method to result
      result.confidence = intent.confidence;
      result.parsingMethod = intent.parsingMethod;

      // 5. Log the query for analytics
      await this.logQuery(request, result, Date.now() - startTime);

      return result;
    } catch (error) {
      logger.error('Natural language permission query error:', error);
      return {
        success: false,
        queryType: 'unknown',
        response: 'I encountered an error processing your query. Please try rephrasing or ask a more specific question.',
        data: null,
        confidence: 0,
        parsingMethod: 'fallback',
      };
    }
  }

  /**
   * Parse query intent using LLM (Gemini AI)
   * Falls back to regex parsing if LLM unavailable
   */
  private async parseQueryIntentWithLLM(query: string): Promise<QueryIntent> {
    const aiAdapter = await this.getAiAdapter();

    if (!aiAdapter) {
      // Fallback to regex-based parsing
      logger.info('Using regex fallback for query parsing');
      return this.parseQueryIntentRegex(query);
    }

    try {
      // Build LLM prompt for intent classification
      const prompt = `You are an expert at parsing natural language permission queries for a multi-tenant access control system.

Parse this query and extract the intent:
"${query}"

Available permissions:
- perm_Read, perm_EditForecast, perm_EditActuals, perm_Delete
- perm_Import, perm_RefreshData, perm_Export
- perm_ViewFinancials (financial/cost data access)
- perm_SaveDraft, perm_Sync
- perm_ManageUsers, perm_ManageSettings, perm_ConfigureAlerts, perm_Impersonate

Available roles: admin, editor, viewer, beo, member

Query types:
1. user_permissions: "What can [user] do?" "Show [user]'s permissions"
2. org_permissions: "Who has access to [org]?" "Users in [org]"
3. capability_search: "Who can [action]?" "Users with [permission]"
4. cross_org_analysis: "Users with access to multiple organizations"

Respond ONLY with valid JSON (no markdown):
{
  "type": "user_permissions|org_permissions|capability_search|cross_org_analysis|unknown",
  "confidence": 0.0-1.0,
  "targetUser": "username or null",
  "targetOrganization": "org code or null",
  "targetCapability": "perm_XXX or role:XXX or null",
  "filters": {
    "hasFinancialAccess": boolean or null,
    "hasAdminAccess": boolean or null,
    "multiOrg": boolean or null,
    "specificPermissions": ["perm_XXX"] or null
  },
  "reasoning": "Brief explanation of classification"
}`;

      const llmResponse = await aiAdapter.chat({
        messages: [
          { role: 'system', content: 'You are a permission query parser. Respond only with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3, // Low temperature for deterministic parsing
        maxTokens: 500,
        userId: 'system',
        organizationId: 'system',
      });

      // Parse JSON response
      let parsedIntent: any;
      try {
        // Remove markdown code blocks if present
        const cleanedText = llmResponse.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsedIntent = JSON.parse(cleanedText);
      } catch (parseError) {
        logger.error('Failed to parse LLM JSON response:', llmResponse.text);
        throw parseError;
      }

      logger.info(`LLM parsed query intent: ${parsedIntent.type} (confidence: ${parsedIntent.confidence})`);

      return {
        type: parsedIntent.type,
        targetUser: parsedIntent.targetUser || undefined,
        targetOrganization: parsedIntent.targetOrganization || undefined,
        targetCapability: parsedIntent.targetCapability || undefined,
        filters: parsedIntent.filters || {},
        confidence: parsedIntent.confidence,
        parsingMethod: 'llm',
        llmReasoning: parsedIntent.reasoning,
      };
    } catch (error) {
      logger.error('LLM parsing failed, falling back to regex:', error);
      return this.parseQueryIntentRegex(query);
    }
  }

  /**
   * Handle low confidence queries
   */
  private handleLowConfidenceQuery(intent: QueryIntent, _originalQuery: string): PermissionQueryResult {
    const confidencePercent = Math.round(intent.confidence * 100);

    return {
      success: false,
      queryType: intent.type,
      response: `I'm not confident enough (${confidencePercent}%) to answer that question correctly. Here are some things you can ask me:\n\n` +
        `**User Lookup:**\n` +
        `- "What can john.doe do?"\n` +
        `- "Show me alice's permissions"\n\n` +
        `**Organization:**\n` +
        `- "Who has access to HOLNG?"\n` +
        `- "List users in Rio Tinto with admin rights"\n\n` +
        `**Capability Search:**\n` +
        `- "Who can delete records?"\n` +
        `- "Show me users with financial access"\n` +
        `- "List users who can manage settings"\n\n` +
        `**Cross-Organization:**\n` +
        `- "Who has access to multiple organizations?"\n` +
        `- "Show me users with admin in more than one org"`,
      data: null,
      confidence: intent.confidence,
      parsingMethod: intent.parsingMethod,
      lowConfidenceWarning: `Query interpretation confidence (${confidencePercent}%) is below the required threshold (70%). Please rephrase your question to be more specific.`,
      suggestedFollowUps: [
        'What can [username] do?',
        'Who can delete records in [organization]?',
        'Show me all users with financial access',
        'Who has access to multiple organizations?',
      ],
    };
  }

  /**
   * Parse the query to determine intent (Regex fallback)
   */
  private async parseQueryIntentRegex(query: string): Promise<QueryIntent> {
    const queryLower = query.toLowerCase();
    const intent: QueryIntent = {
      type: 'unknown',
      filters: {},
      confidence: 0.6,
      parsingMethod: 'regex',
    };

    // Check for user-specific queries
    const userPatterns = [
      /what can (.+?) do/i,
      /(.+?)'s permissions/i,
      /permissions for (.+)/i,
      /show (.+?)'s access/i,
      /what access does (.+?) have/i,
    ];

    for (const pattern of userPatterns) {
      const match = query.match(pattern);
      if (match) {
        intent.type = 'user_permissions';
        intent.targetUser = match[1].trim();
        break;
      }
    }

    // Check for organization-specific queries
    const orgPatterns = [
      /who (?:can|has access to|has) (.+?) in (.+)/i,
      /users in (.+?) (?:with|who have|that have)/i,
      /(.+?) organization users/i,
    ];

    for (const pattern of orgPatterns) {
      const match = query.match(pattern);
      if (match) {
        intent.type = 'org_permissions';
        intent.targetOrganization = match[match.length - 1]?.trim();
        break;
      }
    }

    // Check for capability search queries
    const capabilityPatterns = [
      /who can (.+?)(?:\?|$)/i,
      /users (?:with|who have) (.+?) access/i,
      /show (?:all )?users (?:with|who can) (.+)/i,
      /list users that can (.+)/i,
    ];

    for (const pattern of capabilityPatterns) {
      const match = query.match(pattern);
      if (match) {
        if (intent.type === 'unknown') {
          intent.type = 'capability_search';
        }
        intent.targetCapability = this.normalizeCapability(match[1].trim());
        break;
      }
    }

    // Check for cross-org analysis queries
    if (
      queryLower.includes('across') ||
      queryLower.includes('multiple organizations') ||
      queryLower.includes('all organizations') ||
      queryLower.includes('multi-org')
    ) {
      intent.type = 'cross_org_analysis';
      intent.filters.multiOrg = true;
    }

    // Check for financial access filter
    if (
      queryLower.includes('financial') ||
      queryLower.includes('cost') ||
      queryLower.includes('rate') ||
      queryLower.includes('price')
    ) {
      intent.filters.hasFinancialAccess = true;
      if (intent.type === 'unknown') {
        intent.type = 'capability_search';
        intent.targetCapability = 'perm_ViewFinancials';
      }
    }

    // Check for admin access filter
    if (
      queryLower.includes('admin') ||
      queryLower.includes('administrator') ||
      queryLower.includes('full access')
    ) {
      intent.filters.hasAdminAccess = true;
    }

    return intent;
  }

  /**
   * Normalize a capability from natural language
   */
  private normalizeCapability(capability: string): string {
    const capLower = capability.toLowerCase();

    // Check against aliases
    for (const [permKey, aliases] of Object.entries(PERMISSION_ALIASES)) {
      if (aliases.some(alias => capLower.includes(alias))) {
        return permKey;
      }
    }

    // Check against role aliases
    for (const [role, aliases] of Object.entries(ROLE_ALIASES)) {
      if (aliases.some(alias => capLower.includes(alias))) {
        return `role:${role}`;
      }
    }

    return capability;
  }

  /**
   * Query permissions for a specific user
   */
  private async queryUserPermissions(
    intent: QueryIntent,
    _request: PermissionQueryRequest
  ): Promise<PermissionQueryResult> {
    // Find the user
    const user = await prisma.users.findFirst({
      where: {
        OR: [
          { username: { contains: intent.targetUser, mode: 'insensitive' } },
          { email: { contains: intent.targetUser, mode: 'insensitive' } },
          { firstName: { contains: intent.targetUser, mode: 'insensitive' } },
          { lastName: { contains: intent.targetUser, mode: 'insensitive' } },
        ],
      },
      include: {
        user_organizations: {
          include: {
            organizations: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return {
        success: true,
        queryType: 'user_permissions',
        response: `I couldn't find a user matching "${intent.targetUser}". Please check the username or try a different search term.`,
        data: null,
        confidence: intent.confidence,
        parsingMethod: intent.parsingMethod,
        suggestedFollowUps: [
          'Show me all users',
          'Who has admin access?',
        ],
      };
    }

    // Build permission list
    const permissionsByOrg: Record<string, string[]> = {};

    user.user_organizations.forEach((uo: any) => {
      const orgCode = uo.organizations.code;
      const perms: string[] = [];

      if (uo.perm_Read) perms.push('Read');
      if (uo.perm_EditForecast) perms.push('Edit Forecast');
      if (uo.perm_EditActuals) perms.push('Edit Actuals');
      if (uo.perm_Delete) perms.push('Delete');
      if (uo.perm_Import) perms.push('Import');
      if (uo.perm_RefreshData) perms.push('Refresh Data');
      if (uo.perm_Export) perms.push('Export');
      if (uo.perm_ViewFinancials) perms.push('View Financials');
      if (uo.perm_SaveDraft) perms.push('Save Draft');
      if (uo.perm_Sync) perms.push('Sync');
      if (uo.perm_ManageUsers) perms.push('Manage Users');
      if (uo.perm_ManageSettings) perms.push('Manage Settings');
      if (uo.perm_ConfigureAlerts) perms.push('Configure Alerts');
      if (uo.perm_Impersonate) perms.push('Impersonate');

      permissionsByOrg[orgCode] = perms;
    });

    const orgList = Object.entries(permissionsByOrg)
      .map(([org, perms]) => `**${org}**: ${perms.join(', ')}`)
      .join('\n');

    return {
      success: true,
      queryType: 'user_permissions',
      response: `**${user.username}** (${user.email || 'No email'}) has access to ${user.user_organizations.length} organization(s):\n\n${orgList}`,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
        permissions: permissionsByOrg,
      },
      confidence: intent.confidence,
      parsingMethod: intent.parsingMethod,
      structuredAnswer: {
        users: [{
          id: user.id,
          username: user.username,
          email: user.email || undefined,
          permissions: Object.values(permissionsByOrg).flat(),
          organizations: Object.keys(permissionsByOrg),
        }],
        summary: `${user.username} has access to ${user.user_organizations.length} organizations`,
      },
      suggestedFollowUps: [
        `Who else has access to ${Object.keys(permissionsByOrg)[0]}?`,
        `Show me users with similar permissions`,
      ],
    };
  }

  /**
   * Query permissions within an organization
   */
  private async queryOrganizationPermissions(
    intent: QueryIntent,
    _request: PermissionQueryRequest
  ): Promise<PermissionQueryResult> {
    // Find the organization
    const org = await prisma.organizations.findFirst({
      where: {
        OR: [
          { code: { equals: intent.targetOrganization, mode: 'insensitive' } },
          { name: { contains: intent.targetOrganization, mode: 'insensitive' } },
        ],
      },
    });

    if (!org) {
      return {
        success: true,
        queryType: 'org_permissions',
        response: `I couldn't find an organization matching "${intent.targetOrganization}". Please check the organization code.`,
        data: null,
        confidence: intent.confidence,
        parsingMethod: intent.parsingMethod,
        suggestedFollowUps: [
          'Show me all organizations',
        ],
      };
    }

    // Get users in this org
    let whereClause: any = { organizationId: org.id };

    // Apply capability filter if specified
    if (intent.targetCapability?.startsWith('perm_')) {
      whereClause[intent.targetCapability] = true;
    }
    if (intent.filters.hasFinancialAccess) {
      whereClause.perm_ViewFinancials = true;
    }
    if (intent.filters.hasAdminAccess) {
      whereClause.role = 'admin';
    }

    const userOrgs = await prisma.user_organizations.findMany({
      where: whereClause,
      include: {
        users: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    if (userOrgs.length === 0) {
      const filterDesc = intent.targetCapability
        ? ` with ${intent.targetCapability.replace('perm_', '')} permission`
        : '';
      return {
        success: true,
        queryType: 'org_permissions',
        response: `No users found in ${org.code}${filterDesc}.`,
        data: { organization: org, users: [] },
        confidence: intent.confidence,
        parsingMethod: intent.parsingMethod,
      };
    }

    const userList = userOrgs
      .map((uo: any) => `- **${uo.users.username}** (${uo.role})`)
      .join('\n');

    const filterDesc = intent.targetCapability
      ? ` with ${intent.targetCapability.replace('perm_', '')} permission`
      : '';

    return {
      success: true,
      queryType: 'org_permissions',
      response: `Found **${userOrgs.length}** users in **${org.code}**${filterDesc}:\n\n${userList}`,
      data: {
        organization: org,
        users: userOrgs.map((uo: any) => ({
          id: uo.users.id,
          username: uo.users.username,
          email: uo.users.email,
          role: uo.role,
        })),
      },
      confidence: intent.confidence,
      parsingMethod: intent.parsingMethod,
      structuredAnswer: {
        organizations: [{
          id: org.id,
          code: org.code,
          name: org.name,
          userCount: userOrgs.length,
        }],
        users: userOrgs.map((uo: any) => ({
          id: uo.users.id,
          username: uo.users.username,
          email: uo.users.email || undefined,
          permissions: [],
          organizations: [org.code],
        })),
        summary: `${userOrgs.length} users in ${org.code}`,
      },
      suggestedFollowUps: [
        `What can ${userOrgs[0]?.users.username} do?`,
        `Who has admin access in ${org.code}?`,
      ],
    };
  }

  /**
   * Query users by capability
   */
  private async queryByCapability(
    intent: QueryIntent,
    request: PermissionQueryRequest
  ): Promise<PermissionQueryResult> {
    const capability = intent.targetCapability;

    if (!capability) {
      return {
        success: true,
        queryType: 'capability_search',
        response: 'Please specify which capability you want to search for.',
        data: null,
        confidence: intent.confidence,
        parsingMethod: intent.parsingMethod,
        suggestedFollowUps: [
          'Who can delete records?',
          'Who has financial access?',
          'Who can manage users?',
        ],
      };
    }

    // Build where clause
    let whereClause: any = {};
    let capabilityName = capability;

    if (capability.startsWith('perm_')) {
      whereClause[capability] = true;
      capabilityName = capability.replace('perm_', '');
    } else if (capability.startsWith('role:')) {
      whereClause.role = capability.replace('role:', '');
      capabilityName = whereClause.role;
    }

    // Apply organization filter if specified
    if (request.organizationId) {
      whereClause.organizationId = request.organizationId;
    }

    const userOrgs = await prisma.user_organizations.findMany({
      where: whereClause,
      include: {
        users: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        organizations: {
          select: {
            code: true,
            name: true,
          },
        },
      },
      take: 50, // Limit results
    });

    if (userOrgs.length === 0) {
      return {
        success: true,
        queryType: 'capability_search',
        response: `No users found with ${capabilityName} capability.`,
        data: { capability, users: [] },
        confidence: intent.confidence,
        parsingMethod: intent.parsingMethod,
      };
    }

    // Group by user
    const userMap = new Map<string, { user: any; orgs: string[] }>();
    userOrgs.forEach((uo: any) => {
      const existing = userMap.get(uo.users.id) || { user: uo.users, orgs: [] };
      existing.orgs.push(uo.organizations.code);
      userMap.set(uo.users.id, existing);
    });

    const userList = Array.from(userMap.values())
      .map(({ user, orgs }) => `- **${user.username}** (${orgs.join(', ')})`)
      .join('\n');

    return {
      success: true,
      queryType: 'capability_search',
      response: `Found **${userMap.size}** users with **${capabilityName}** capability:\n\n${userList}`,
      data: {
        capability,
        users: Array.from(userMap.values()).map(({ user, orgs }) => ({
          ...user,
          organizations: orgs,
        })),
      },
      confidence: intent.confidence,
      parsingMethod: intent.parsingMethod,
      structuredAnswer: {
        users: Array.from(userMap.values()).map(({ user, orgs }) => ({
          id: user.id,
          username: user.username,
          email: user.email || undefined,
          permissions: [capabilityName],
          organizations: orgs,
        })),
        capabilities: [capabilityName],
        summary: `${userMap.size} users have ${capabilityName} access`,
      },
      suggestedFollowUps: [
        `Show me users with multiple high-risk permissions`,
        `Who has admin access?`,
      ],
    };
  }

  /**
   * Query for cross-organization analysis
   */
  private async queryCrossOrgAnalysis(
    intent: QueryIntent,
    _request: PermissionQueryRequest
  ): Promise<PermissionQueryResult> {
    // Find users with access to multiple organizations
    const userOrgCounts = await prisma.user_organizations.groupBy({
      by: ['userId'],
      _count: {
        organizationId: true,
      },
      having: {
        organizationId: {
          _count: {
            gte: 2,
          },
        },
      },
    });

    if (userOrgCounts.length === 0) {
      return {
        success: true,
        queryType: 'cross_org_analysis',
        response: 'No users found with access to multiple organizations.',
        data: { users: [] },
        confidence: intent.confidence,
        parsingMethod: intent.parsingMethod,
      };
    }

    // Get user details
    const userIds = userOrgCounts.map((uc: any) => uc.userId);
    const users = await prisma.users.findMany({
      where: { id: { in: userIds } },
      include: {
        user_organizations: {
          include: {
            organizations: {
              select: {
                code: true,
              },
            },
          },
        },
      },
    });

    const userList = users
      .map((u: any) => {
        const orgs = u.user_organizations.map((o: any) => o.organizations.code).join(', ');
        const hasAdmin = u.user_organizations.some((o: any) => o.role === 'admin');
        const hasFinancial = u.user_organizations.some((o: any) => o.perm_ViewFinancials);
        const flags = [
          hasAdmin && 'Admin',
          hasFinancial && 'Financial',
        ].filter(Boolean).join(', ');

        return `- **${u.username}**: ${u.user_organizations.length} orgs (${orgs})${flags ? ` [${flags}]` : ''}`;
      })
      .join('\n');

    return {
      success: true,
      queryType: 'cross_org_analysis',
      response: `Found **${users.length}** users with multi-organization access:\n\n${userList}`,
      data: {
        users: users.map((u: any) => ({
          id: u.id,
          username: u.username,
          organizationCount: u.user_organizations.length,
          organizations: u.user_organizations.map((o: any) => o.organizations.code),
          hasAdminInAny: u.user_organizations.some((o: any) => o.role === 'admin'),
          hasFinancialInAny: u.user_organizations.some((o: any) => o.perm_ViewFinancials),
        })),
      },
      confidence: intent.confidence,
      parsingMethod: intent.parsingMethod,
      structuredAnswer: {
        users: users.map((u: any) => ({
          id: u.id,
          username: u.username,
          email: u.email || undefined,
          permissions: [],
          organizations: u.user_organizations.map((o: any) => o.organizations.code),
        })),
        summary: `${users.length} users have multi-organization access`,
      },
      suggestedFollowUps: [
        'Who has admin access in multiple organizations?',
        'Show me users with financial access across all orgs',
      ],
    };
  }

  /**
   * Handle unknown query types
   */
  private async handleUnknownQuery(_request: PermissionQueryRequest): Promise<PermissionQueryResult> {
    return {
      success: true,
      queryType: 'unknown',
      response: `I'm not sure how to answer that question. Here are some things you can ask me:\n\n` +
        `- "What can [username] do?"\n` +
        `- "Who can delete records in [organization]?"\n` +
        `- "Show me all users with financial access"\n` +
        `- "Who has access to multiple organizations?"\n` +
        `- "List users with admin rights"`,
      data: null,
      confidence: 0,
      parsingMethod: 'fallback',
      suggestedFollowUps: [
        'Who can delete records?',
        'Who has admin access?',
        'Show me users with financial access',
      ],
    };
  }

  /**
   * Log query for analytics
   */
  private async logQuery(
    request: PermissionQueryRequest,
    result: PermissionQueryResult,
    durationMs: number
  ): Promise<void> {
    try {
      const { randomUUID } = await import('crypto');
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          userId: request.userId,
          organizationId: request.organizationId || null,
          action: 'nl_permission_query',
          resource: 'permissions',
          method: 'QUERY',
          success: result.success,
          metadata: {
            query: request.query,
            queryType: result.queryType,
            resultCount: result.structuredAnswer?.users?.length || 0,
            durationMs,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to log permission query:', error);
    }
  }
}

export default new NaturalLanguagePermissionService();
