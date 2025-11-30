/**
 * AI Feature Enforcement Middleware
 * Validates user has access to specific AI features at org/role/user levels
 *
 * Three-tier inheritance: Organization -> Role Template -> User Override
 * - Organization must have the feature enabled
 * - User must have perm_UseAiFeatures (master toggle)
 * - User's specific AI feature must be enabled
 * - Access level checked (full-access vs read-only)
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import { logger } from '../utils/logger';
import prisma from '../config/database';

/**
 * AI Feature keys matching schema columns
 */
export type AiFeature =
  | 'ai_ChatAssistant'
  | 'ai_VoiceMode'
  | 'ai_PermissionSuggestions'
  | 'ai_PermissionExplanations'
  | 'ai_RoleDriftDetection'
  | 'ai_NaturalLanguageQueries'
  | 'ai_AnomalyDetection'
  | 'ai_FinancialMonitoring'
  | 'ai_SemanticAuditSearch'
  | 'ai_FinancialMasking'
  | 'ai_VendorPricingWatchdog'
  | 'ai_BeoVoiceAnalyst'
  | 'ai_NarrativeVariance'
  | 'ai_AssetArbitrage'
  | 'ai_ScenarioSimulator'
  | 'ai_SmartNotifications';

export type AiAccessLevel = 'full-access' | 'read-only';

interface AiFeatureContext {
  orgEnabled: boolean;
  userEnabled: boolean;
  accessLevel: AiAccessLevel;
  aiRules: string[];
}

/**
 * Require specific AI feature for the authenticated user
 *
 * Usage:
 * ```
 * router.post('/chat', authenticateJWT, requireAiFeature('ai_ChatAssistant'), handler);
 * router.post('/suggest', authenticateJWT, requireAiFeature('ai_PermissionSuggestions', 'full-access'), handler);
 * ```
 *
 * @param feature - AI feature to check
 * @param requiredAccessLevel - Optional required access level (default: any)
 * @param organizationIdField - Field name containing organizationId (default: 'organizationId')
 */
export function requireAiFeature(
  feature: AiFeature,
  requiredAccessLevel?: AiAccessLevel,
  organizationIdField: string = 'organizationId'
) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();

    try {
      if (!req.user) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      // Extract organization ID
      const orgId =
        req.body[organizationIdField] ||
        req.query[organizationIdField] ||
        req.params[organizationIdField] ||
        req.organizationId;

      if (!orgId) {
        res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'Organization ID required for AI feature access',
          field: organizationIdField,
        });
        return;
      }

      // Check user has access to organization
      const userOrg = req.user.organizations.find(o => o.organizationId === orgId);
      if (!userOrg) {
        await logAiFeatureDenial(
          req.user.userId,
          req.user.username,
          orgId,
          feature,
          req.path,
          'ORG_ACCESS_DENIED'
        );

        res.status(403).json({
          error: 'ORG_ACCESS_DENIED',
          message: `You don't have access to organization ${orgId}`,
          organizationId: orgId,
        });
        return;
      }

      // Fetch detailed AI feature settings from database
      const context = await getAiFeatureContext(req.user.userId, orgId, feature);

      // Check if organization has the feature enabled
      if (!context.orgEnabled) {
        await logAiFeatureDenial(
          req.user.userId,
          req.user.username,
          orgId,
          feature,
          req.path,
          'ORG_FEATURE_DISABLED'
        );

        res.status(403).json({
          error: 'AI_FEATURE_DISABLED',
          message: `AI feature ${feature.replace('ai_', '')} is not enabled for this organization`,
          feature,
          organizationId: orgId,
        });
        return;
      }

      // Check if user has the feature enabled
      if (!context.userEnabled) {
        await logAiFeatureDenial(
          req.user.userId,
          req.user.username,
          orgId,
          feature,
          req.path,
          'USER_FEATURE_DISABLED'
        );

        res.status(403).json({
          error: 'AI_FEATURE_DISABLED',
          message: `AI feature ${feature.replace('ai_', '')} is not enabled for your account`,
          feature,
          organizationId: orgId,
        });
        return;
      }

      // Check access level if required
      if (requiredAccessLevel && context.accessLevel !== requiredAccessLevel) {
        if (requiredAccessLevel === 'full-access' && context.accessLevel === 'read-only') {
          await logAiFeatureDenial(
            req.user.userId,
            req.user.username,
            orgId,
            feature,
            req.path,
            'INSUFFICIENT_ACCESS_LEVEL'
          );

          res.status(403).json({
            error: 'AI_ACCESS_LEVEL_INSUFFICIENT',
            message: 'This action requires full AI access. You have read-only access.',
            feature,
            requiredAccessLevel,
            currentAccessLevel: context.accessLevel,
            organizationId: orgId,
          });
          return;
        }
      }

      // Attach AI context to request for downstream handlers
      req.aiContext = {
        feature,
        accessLevel: context.accessLevel,
        aiRules: context.aiRules,
        organizationId: orgId,
      };

      const elapsed = Date.now() - startTime;

      if (elapsed > 100) {
        logger.warn('AI feature check exceeded 100ms target', {
          elapsed,
          feature,
          organizationId: orgId,
          endpoint: req.path,
        });
      }

      next();
    } catch (error) {
      logger.error('AI feature middleware error', {
        error,
        feature,
        endpoint: req.path,
      });

      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'AI feature check failed',
      });
    }
  };
}

/**
 * Require any of multiple AI features (OR logic)
 */
export function requireAnyAiFeature(
  features: AiFeature[],
  organizationIdField: string = 'organizationId'
) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      const orgId =
        req.body[organizationIdField] ||
        req.query[organizationIdField] ||
        req.params[organizationIdField] ||
        req.organizationId;

      if (!orgId) {
        res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'Organization ID required for AI feature access',
        });
        return;
      }

      // Check user has access to organization
      const userOrg = req.user.organizations.find(o => o.organizationId === orgId);
      if (!userOrg) {
        res.status(403).json({
          error: 'ORG_ACCESS_DENIED',
          message: `You don't have access to organization ${orgId}`,
        });
        return;
      }

      // Check if user has ANY of the required features
      for (const feature of features) {
        const context = await getAiFeatureContext(req.user.userId, orgId, feature);
        if (context.orgEnabled && context.userEnabled) {
          req.aiContext = {
            feature,
            accessLevel: context.accessLevel,
            aiRules: context.aiRules,
            organizationId: orgId,
          };
          next();
          return;
        }
      }

      // None of the features are enabled
      res.status(403).json({
        error: 'AI_FEATURE_DISABLED',
        message: `None of the required AI features are enabled: ${features.join(', ')}`,
        features,
        organizationId: orgId,
      });
    } catch (error) {
      logger.error('AI feature middleware error (any)', { error });
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'AI feature check failed',
      });
    }
  };
}

/**
 * Middleware to check AI master toggle (perm_UseAiFeatures)
 * Use this before AI routes to quickly reject users without AI access
 */
export function requireAiAccess(organizationIdField: string = 'organizationId') {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      const orgId =
        req.body[organizationIdField] ||
        req.query[organizationIdField] ||
        req.params[organizationIdField] ||
        req.organizationId;

      // If no org specified, check if user has AI access in ANY org
      if (!orgId) {
        const hasAnyAiAccess = await checkUserHasAnyAiAccess(req.user.userId);
        if (!hasAnyAiAccess) {
          res.status(403).json({
            error: 'AI_ACCESS_DENIED',
            message: 'You do not have access to AI features in any organization',
          });
          return;
        }
        next();
        return;
      }

      // Check specific organization
      const userOrgAccess = await prisma.user_organizations.findUnique({
        where: {
          userId_organizationId: {
            userId: req.user.userId,
            organizationId: orgId,
          },
        },
        select: {
          perm_UseAiFeatures: true,
        },
      });

      if (!userOrgAccess?.perm_UseAiFeatures) {
        await logAiFeatureDenial(
          req.user.userId,
          req.user.username,
          orgId,
          'MASTER_TOGGLE',
          req.path,
          'AI_MASTER_DISABLED'
        );

        res.status(403).json({
          error: 'AI_ACCESS_DENIED',
          message: 'AI features are not enabled for your account',
          organizationId: orgId,
        });
        return;
      }

      req.organizationId = orgId;
      next();
    } catch (error) {
      logger.error('AI access middleware error', { error });
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'AI access check failed',
      });
    }
  };
}

/**
 * Get AI feature context from database
 * Resolves effective permissions from org -> role -> user hierarchy
 */
async function getAiFeatureContext(
  userId: string,
  organizationId: string,
  feature: AiFeature
): Promise<AiFeatureContext> {
  // Fetch organization settings - select all AI feature columns
  const org = await prisma.organizations.findUnique({
    where: { id: organizationId },
    select: {
      ai_ChatAssistant: true,
      ai_VoiceMode: true,
      ai_PermissionSuggestions: true,
      ai_PermissionExplanations: true,
      ai_RoleDriftDetection: true,
      ai_NaturalLanguageQueries: true,
      ai_AnomalyDetection: true,
      ai_FinancialMonitoring: true,
      ai_SemanticAuditSearch: true,
      ai_FinancialMasking: true,
      ai_VendorPricingWatchdog: true,
      ai_BeoVoiceAnalyst: true,
      ai_NarrativeVariance: true,
      ai_AssetArbitrage: true,
      ai_ScenarioSimulator: true,
      ai_SmartNotifications: true,
      aiAccessLevel: true,
      aiRules: true,
    },
  });

  // Fetch user-org assignment with AI settings
  const userOrg = await prisma.user_organizations.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    select: {
      perm_UseAiFeatures: true,
      ai_ChatAssistant: true,
      ai_VoiceMode: true,
      ai_PermissionSuggestions: true,
      ai_PermissionExplanations: true,
      ai_RoleDriftDetection: true,
      ai_NaturalLanguageQueries: true,
      ai_AnomalyDetection: true,
      ai_FinancialMonitoring: true,
      ai_SemanticAuditSearch: true,
      ai_FinancialMasking: true,
      ai_VendorPricingWatchdog: true,
      ai_BeoVoiceAnalyst: true,
      ai_NarrativeVariance: true,
      ai_AssetArbitrage: true,
      ai_ScenarioSimulator: true,
      ai_SmartNotifications: true,
      aiAccessLevel: true,
      aiRules: true,
    },
  });

  // Type-safe feature access using explicit property lookup
  const orgFeatureValue = org ? org[feature] : false;
  const userFeatureValue = userOrg ? userOrg[feature] : false;

  const orgEnabled = Boolean(orgFeatureValue);
  const userHasMasterToggle = Boolean(userOrg?.perm_UseAiFeatures);
  const userFeatureEnabled = Boolean(userFeatureValue);

  // User feature is enabled if: master toggle ON AND specific feature ON
  const userEnabled = userHasMasterToggle && userFeatureEnabled;

  // Access level: user override > org default
  const userAccessLevel = userOrg?.aiAccessLevel;
  const orgAccessLevel = org?.aiAccessLevel;
  const accessLevel: AiAccessLevel =
    (userAccessLevel === 'full-access' || userAccessLevel === 'read-only' ? userAccessLevel : null) ||
    (orgAccessLevel === 'full-access' || orgAccessLevel === 'read-only' ? orgAccessLevel : null) ||
    'full-access';

  // AI Rules: merge org + user rules (stored as JSON arrays)
  const orgRulesRaw = org?.aiRules;
  const userRulesRaw = userOrg?.aiRules;
  const orgRules: string[] = Array.isArray(orgRulesRaw) ? (orgRulesRaw as string[]) : [];
  const userRules: string[] = Array.isArray(userRulesRaw) ? (userRulesRaw as string[]) : [];
  const aiRules = [...orgRules, ...userRules];

  return {
    orgEnabled,
    userEnabled,
    accessLevel,
    aiRules,
  };
}

/**
 * Check if user has AI access in any organization
 */
async function checkUserHasAnyAiAccess(userId: string): Promise<boolean> {
  const result = await prisma.user_organizations.findFirst({
    where: {
      userId,
      perm_UseAiFeatures: true,
    },
    select: { id: true },
  });
  return !!result;
}

/**
 * Log AI feature denial for security analysis
 */
async function logAiFeatureDenial(
  userId: string,
  username: string,
  organizationId: string,
  feature: string,
  endpoint: string,
  reason: string
): Promise<void> {
  try {
    await prisma.audit_logs.create({
      data: {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        organizationId,
        action: 'ai_feature_denied',
        resource: endpoint,
        method: 'AI_CHECK',
        success: false,
        metadata: {
          username,
          feature,
          reason,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Failed to log AI feature denial', { error });
  }

  logger.warn('AI_FEATURE_DENIAL', {
    userId,
    username,
    organizationId,
    feature,
    endpoint,
    reason,
  });
}

/**
 * Helper to check AI feature access programmatically (non-blocking)
 */
export async function hasAiFeature(
  userId: string,
  organizationId: string,
  feature: AiFeature
): Promise<boolean> {
  try {
    const context = await getAiFeatureContext(userId, organizationId, feature);
    return context.orgEnabled && context.userEnabled;
  } catch {
    return false;
  }
}

/**
 * Helper to get user's AI access level
 */
export async function getAiAccessLevel(
  userId: string,
  organizationId: string
): Promise<AiAccessLevel> {
  try {
    const userOrg = await prisma.user_organizations.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      select: {
        aiAccessLevel: true,
      },
    });

    return (userOrg?.aiAccessLevel as AiAccessLevel) || 'full-access';
  } catch {
    return 'full-access';
  }
}

// Extend AuthRequest to include AI context
declare module '../types/auth' {
  interface AuthRequest {
    aiContext?: {
      feature: AiFeature;
      accessLevel: AiAccessLevel;
      aiRules: string[];
      organizationId: string;
    };
  }
}
