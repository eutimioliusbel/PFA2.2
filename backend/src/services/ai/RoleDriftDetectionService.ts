// backend/src/services/ai/RoleDriftDetectionService.ts
/**
 * Role Drift Detection Service
 *
 * Phase 7, Task 7.4 of ADR-005 Multi-Tenant Access Control
 * AI Use Case 19: Role Drift Detection and Role Template Suggestions
 *
 * Analyzes user-role-capability patterns to detect when users accumulate
 * similar custom overrides. When detected, suggests creating new role templates
 * and provides one-click migration.
 *
 * Key Features:
 * - Detects consistent override patterns (3+ users with 60%+ identical overrides)
 * - Suggests new role templates based on patterns
 * - One-click role refactoring with rollback support
 * - Weekly scheduled analysis
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export type DriftType = 'CONSISTENT_OVERRIDES' | 'EXCESSIVE_OVERRIDES' | 'ROLE_MISMATCH';
export type RecommendedAction = 'CREATE_NEW_ROLE' | 'NORMALIZE_OVERRIDES' | 'REVIEW_MANUALLY';

export interface DriftPattern {
  id: string;
  driftType: DriftType;
  baseRole: string;
  baseRoleId: string | null;
  commonOverrides: Record<string, boolean>;
  affectedUsers: Array<{
    userId: string;
    username: string;
    email: string | null;
    overrides: Record<string, boolean>;
  }>;
  frequency: string;
  suggestedNewRole: {
    name: string;
    inheritsFrom: string;
    additionalCapabilities: Record<string, boolean>;
  };
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  detectedAt: Date;
}

export interface DriftRecommendation {
  patternId: string;
  action: RecommendedAction;
  impact: string;
  confidence: number;
  reasoning: string;
}

export interface DriftDetectionResult {
  driftDetected: boolean;
  patterns: DriftPattern[];
  recommendations: DriftRecommendation[];
  summary: {
    totalUsersAnalyzed: number;
    usersWithOverrides: number;
    patternsDetected: number;
    estimatedOverridesToRemove: number;
  };
  lastAnalyzedAt: Date;
}

export interface RefactorResult {
  success: boolean;
  newRoleCreated: boolean;
  newRoleId?: string;
  newRoleName?: string;
  usersMigrated: number;
  overridesRemoved: number;
  rollbackId: string;
  rollbackAvailable: boolean;
  rollbackExpiresAt: Date;
  error?: string;
}

interface RefactorHistory {
  id: string;
  patternId: string;
  newRoleId: string;
  migratedUsers: Array<{
    userId: string;
    previousRoleId: string | null;
    previousOverrides: Record<string, boolean>;
  }>;
  adminUserId: string;
  appliedAt: Date;
  expiresAt: Date;
  rolledBack: boolean;
}

// ============================================================================
// Service Implementation
// ============================================================================

class RoleDriftDetectionService {
  private prisma: PrismaClient;
  private refactorHistory: Map<string, RefactorHistory> = new Map();

  constructor() {
    this.prisma = new PrismaClient();

    // Note: Google AI integration reserved for future enhancement
    // Currently using rule-based recommendations
    logger.info('[RoleDriftDetectionService] Initialized with rule-based recommendations');
  }

  // ============================================================================
  // Main Detection Method
  // ============================================================================

  /**
   * Detect role drift patterns across organization
   */
  async detectRoleDrift(params: { organizationId: string }): Promise<DriftDetectionResult> {
    const { organizationId } = params;
    const startTime = Date.now();

    logger.info('[RoleDriftDetection] Starting drift detection', { organizationId });

    try {
      // Fetch all user-org relationships with their permission overrides
      const userOrgs = await this.prisma.user_organizations.findMany({
        where: { organizationId },
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
        return {
          driftDetected: false,
          patterns: [],
          recommendations: [],
          summary: {
            totalUsersAnalyzed: 0,
            usersWithOverrides: 0,
            patternsDetected: 0,
            estimatedOverridesToRemove: 0,
          },
          lastAnalyzedAt: new Date(),
        };
      }

      // Group by role
      const roleGroups = this.groupByRole(userOrgs);

      // Detect drift patterns
      const patterns: DriftPattern[] = [];

      for (const [roleName, users] of Object.entries(roleGroups)) {
        // Find users with permission overrides
        const usersWithOverrides = users.filter(u => {
          const overrides = this.extractOverrides(u);
          return Object.keys(overrides).length > 0;
        });

        // Need at least 3 users with overrides to detect a pattern
        if (usersWithOverrides.length < 3) continue;

        // Find common override patterns
        const overrideSets = usersWithOverrides.map(u => this.extractOverrides(u));
        const commonPattern = this.findCommonOverrides(overrideSets);

        if (commonPattern && Object.keys(commonPattern).length >= 2) {
          // Found drift pattern!
          const affectedUsers = usersWithOverrides
            .filter(u => this.hasOverrides(this.extractOverrides(u), commonPattern))
            .map(u => ({
              userId: u.userId,
              username: u.users.username,
              email: u.users.email,
              overrides: this.extractOverrides(u),
            }));

          if (affectedUsers.length >= 3) {
            const frequency = `${affectedUsers.length} out of ${users.length} ${roleName}s (${Math.round((affectedUsers.length / users.length) * 100)}%)`;

            const pattern: DriftPattern = {
              id: `drift-${Date.now()}-${roleName.replace(/\s+/g, '-')}`,
              driftType: 'CONSISTENT_OVERRIDES',
              baseRole: roleName,
              baseRoleId: null, // Role is a string field, not a separate model
              commonOverrides: commonPattern,
              affectedUsers,
              frequency,
              suggestedNewRole: {
                name: this.suggestRoleName(roleName, commonPattern),
                inheritsFrom: roleName,
                additionalCapabilities: commonPattern,
              },
              severity: this.calculateSeverity(affectedUsers.length, Object.keys(commonPattern).length),
              detectedAt: new Date(),
            };

            patterns.push(pattern);
          }
        }

        // Check for excessive overrides (single user with too many)
        const excessiveOverrideUsers = usersWithOverrides.filter(u => {
          const overrides = this.extractOverrides(u);
          return Object.keys(overrides).length >= 5;
        });

        for (const user of excessiveOverrideUsers) {
          const overrides = this.extractOverrides(user);
          patterns.push({
            id: `drift-excessive-${Date.now()}-${user.userId}`,
            driftType: 'EXCESSIVE_OVERRIDES',
            baseRole: roleName,
            baseRoleId: null, // Role is a string field, not a separate model
            commonOverrides: overrides,
            affectedUsers: [{
              userId: user.userId,
              username: user.users.username,
              email: user.users.email,
              overrides,
            }],
            frequency: `1 user with ${Object.keys(overrides).length} custom overrides`,
            suggestedNewRole: {
              name: `Custom ${roleName}`,
              inheritsFrom: roleName,
              additionalCapabilities: overrides,
            },
            severity: 'LOW',
            detectedAt: new Date(),
          });
        }
      }

      // Generate recommendations
      const recommendations = await this.generateRecommendations(patterns);

      // Calculate summary
      const usersWithOverrides = userOrgs.filter(u => {
        const overrides = this.extractOverrides(u);
        return Object.keys(overrides).length > 0;
      });

      const estimatedOverridesToRemove = patterns.reduce((sum, p) => {
        return sum + (p.affectedUsers.length * Object.keys(p.commonOverrides).length);
      }, 0);

      const executionTime = Date.now() - startTime;
      logger.info('[RoleDriftDetection] Detection completed', {
        organizationId,
        patternsDetected: patterns.length,
        executionTimeMs: executionTime,
      });

      return {
        driftDetected: patterns.length > 0,
        patterns,
        recommendations,
        summary: {
          totalUsersAnalyzed: userOrgs.length,
          usersWithOverrides: usersWithOverrides.length,
          patternsDetected: patterns.length,
          estimatedOverridesToRemove,
        },
        lastAnalyzedAt: new Date(),
      };
    } catch (error) {
      logger.error('[RoleDriftDetection] Detection failed', { error, organizationId });
      throw error;
    }
  }

  // ============================================================================
  // Role Refactoring
  // ============================================================================

  /**
   * Apply role refactor - update users' role string and normalize permissions
   *
   * Note: This schema doesn't have a separate Role model. Instead, roles are
   * string values in UserOrganization.role field. This refactor will:
   * 1. Create a new role name string
   * 2. Update affected users to use the new role name
   * 3. The permissions are already set correctly (they were the overrides)
   */
  async applyRoleRefactor(params: {
    pattern: DriftPattern;
    adminUserId: string;
    organizationId: string;
    customRoleName?: string;
  }): Promise<RefactorResult> {
    const { pattern, adminUserId, organizationId, customRoleName } = params;

    logger.info('[RoleDriftDetection] Applying role refactor', {
      patternId: pattern.id,
      adminUserId,
      organizationId,
    });

    try {
      // The new role name to assign
      const newRoleName = customRoleName || pattern.suggestedNewRole.name;

      // Store migration history for rollback
      const migratedUsers: RefactorHistory['migratedUsers'] = [];

      // Start transaction
      await this.prisma.$transaction(async (tx) => {
        // Migrate affected users to new role name
        for (const affectedUser of pattern.affectedUsers) {
          const userOrg = await tx.user_organizations.findFirst({
            where: {
              userId: affectedUser.userId,
              organizationId,
            },
          });

          if (userOrg) {
            // Store current state for rollback
            migratedUsers.push({
              userId: affectedUser.userId,
              previousRoleId: userOrg.role, // The role is a string, not an ID
              previousOverrides: affectedUser.overrides,
            });

            // Update user to new role name (permissions stay as-is since they're already set)
            await tx.user_organizations.update({
              where: { id: userOrg.id },
              data: {
                role: newRoleName,
                isCustom: false, // Now using the standardized role
                modifiedBy: adminUserId,
              },
            });
          }
        }

        // Create audit log entry
        await tx.audit_logs.create({
          data: {
            id: randomUUID(),
            userId: adminUserId,
            organizationId,
            action: 'role_drift_refactor',
            resource: 'UserOrganization',
            method: 'POST',
            success: true,
            metadata: {
              patternId: pattern.id,
              driftType: pattern.driftType,
              newRoleName,
              usersMigrated: migratedUsers.length,
              overridesNormalized: Object.keys(pattern.commonOverrides).length,
              baseRole: pattern.baseRole,
              affectedUserIds: migratedUsers.map(u => u.userId),
            },
          },
        });
      });

      // Store refactor history for rollback (7 days)
      const rollbackId = `rollback-${Date.now()}`;
      const rollbackExpiresAt = new Date();
      rollbackExpiresAt.setDate(rollbackExpiresAt.getDate() + 7);

      this.refactorHistory.set(rollbackId, {
        id: rollbackId,
        patternId: pattern.id,
        newRoleId: newRoleName, // Store role name as ID
        migratedUsers,
        adminUserId,
        appliedAt: new Date(),
        expiresAt: rollbackExpiresAt,
        rolledBack: false,
      });

      logger.info('[RoleDriftDetection] Role refactor completed', {
        newRoleName,
        usersMigrated: migratedUsers.length,
        rollbackId,
      });

      return {
        success: true,
        newRoleCreated: true,
        newRoleId: newRoleName,
        newRoleName,
        usersMigrated: migratedUsers.length,
        overridesRemoved: Object.keys(pattern.commonOverrides).length * migratedUsers.length,
        rollbackId,
        rollbackAvailable: true,
        rollbackExpiresAt,
      };
    } catch (error: unknown) {
      logger.error('[RoleDriftDetection] Role refactor failed', { error, patternId: pattern.id });
      return {
        success: false,
        newRoleCreated: false,
        usersMigrated: 0,
        overridesRemoved: 0,
        rollbackId: '',
        rollbackAvailable: false,
        rollbackExpiresAt: new Date(),
        error: (error as any).message || 'Failed to apply role refactor',
      };
    }
  }

  /**
   * Rollback a role refactor
   */
  async rollbackRefactor(params: {
    rollbackId: string;
    adminUserId: string;
    organizationId: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { rollbackId, adminUserId, organizationId } = params;

    const history = this.refactorHistory.get(rollbackId);
    if (!history) {
      return { success: false, error: 'Rollback not found' };
    }

    if (history.rolledBack) {
      return { success: false, error: 'Already rolled back' };
    }

    if (new Date() > history.expiresAt) {
      return { success: false, error: 'Rollback window expired (7 days)' };
    }

    logger.info('[RoleDriftDetection] Rolling back refactor', { rollbackId, adminUserId });

    try {
      await this.prisma.$transaction(async (tx) => {
        // Restore each user's previous role
        for (const user of history.migratedUsers) {
          const userOrg = await tx.user_organizations.findFirst({
            where: {
              userId: user.userId,
              organizationId,
            },
          });

          if (userOrg) {
            await tx.user_organizations.update({
              where: { id: userOrg.id },
              data: {
                role: user.previousRoleId || 'member', // previousRoleId is actually the role string, default to 'member' if null
                isCustom: true, // Mark as custom since we're restoring overrides
                modifiedBy: adminUserId,
              },
            });
          }
        }

        // Create audit log entry
        await tx.audit_logs.create({
          data: {
            id: randomUUID(),
            userId: adminUserId,
            organizationId,
            action: 'role_drift_rollback',
            resource: 'UserOrganization',
            method: 'POST',
            success: true,
            metadata: {
              rollbackId,
              originalPatternId: history.patternId,
              roleName: history.newRoleId,
              usersRestored: history.migratedUsers.length,
            },
          },
        });
      });

      // Mark as rolled back
      history.rolledBack = true;

      logger.info('[RoleDriftDetection] Rollback completed', {
        rollbackId,
        usersRestored: history.migratedUsers.length,
      });

      return { success: true };
    } catch (error: unknown) {
      logger.error('[RoleDriftDetection] Rollback failed', { error, rollbackId });
      return { success: false, error: (error as any).message || 'Rollback failed' };
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Group user-org relationships by role
   * Note: role is a string field (not an object), e.g., "admin", "member", "viewer"
   */
  private groupByRole(userOrgs: any[]): Record<string, any[]> {
    return userOrgs.reduce((acc, uo) => {
      const roleName = uo.role || 'No Role';
      if (!acc[roleName]) acc[roleName] = [];
      acc[roleName].push(uo);
      return acc;
    }, {} as Record<string, any[]>);
  }

  /**
   * Extract permission overrides from a user-org relationship
   */
  private extractOverrides(userOrg: any): Record<string, boolean> {
    const overrides: Record<string, boolean> = {};

    const permissionFields = [
      'perm_ViewForecast',
      'perm_EditForecast',
      'perm_ApproveChanges',
      'perm_ViewFinancials',
      'perm_ManageUsers',
      'perm_ManageSettings',
      'perm_ViewAuditLog',
      'perm_Export',
      'perm_BulkEdit',
      'perm_ManageApiConnections',
    ];

    for (const field of permissionFields) {
      if (userOrg[field] !== null && userOrg[field] !== undefined) {
        overrides[field] = userOrg[field];
      }
    }

    return overrides;
  }

  /**
   * Find common overrides across multiple users (60% threshold)
   */
  private findCommonOverrides(overrideSets: Record<string, boolean>[]): Record<string, boolean> | null {
    if (overrideSets.length < 3) return null;

    // Count frequency of each override
    const overrideCounts: Record<string, { trueCount: number; falseCount: number }> = {};

    overrideSets.forEach(overrides => {
      Object.entries(overrides).forEach(([key, value]) => {
        if (!overrideCounts[key]) {
          overrideCounts[key] = { trueCount: 0, falseCount: 0 };
        }
        if (value === true) {
          overrideCounts[key].trueCount++;
        } else {
          overrideCounts[key].falseCount++;
        }
      });
    });

    // Find overrides present in 60%+ of users
    const threshold = Math.ceil(overrideSets.length * 0.6);
    const commonOverrides: Record<string, boolean> = {};

    Object.entries(overrideCounts).forEach(([key, counts]) => {
      const total = counts.trueCount + counts.falseCount;
      if (total >= threshold) {
        // Use the most common value
        commonOverrides[key] = counts.trueCount >= counts.falseCount;
      }
    });

    return Object.keys(commonOverrides).length >= 2 ? commonOverrides : null;
  }

  /**
   * Check if user has the specified overrides
   */
  private hasOverrides(userOverrides: Record<string, boolean>, targetOverrides: Record<string, boolean>): boolean {
    return Object.entries(targetOverrides).every(([key, value]) => userOverrides[key] === value);
  }

  /**
   * Calculate severity based on affected users and override count
   */
  private calculateSeverity(affectedUserCount: number, overrideCount: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    const score = affectedUserCount * overrideCount;
    if (score >= 20) return 'HIGH';
    if (score >= 10) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Suggest a name for the new role
   */
  private suggestRoleName(baseRole: string, overrides: Record<string, boolean>): string {
    // Check for common patterns
    if (overrides.perm_ManageUsers && overrides.perm_ManageSettings) {
      return `Admin ${baseRole}`;
    }
    if (overrides.perm_ViewFinancials) {
      return `Financial ${baseRole}`;
    }
    if (overrides.perm_ApproveChanges) {
      return `Senior ${baseRole}`;
    }
    if (overrides.perm_BulkEdit && overrides.perm_Export) {
      return `Power ${baseRole}`;
    }
    return `Enhanced ${baseRole}`;
  }

  /**
   * Generate recommendations using rule-based logic
   * Note: AI-powered recommendations reserved for future enhancement
   */
  private async generateRecommendations(patterns: DriftPattern[]): Promise<DriftRecommendation[]> {
    const recommendations: DriftRecommendation[] = [];

    for (const pattern of patterns) {
      if (pattern.driftType === 'CONSISTENT_OVERRIDES') {
        recommendations.push({
          patternId: pattern.id,
          action: 'CREATE_NEW_ROLE',
          impact: `Affects ${pattern.affectedUsers.length} users, removes ${Object.keys(pattern.commonOverrides).length * pattern.affectedUsers.length} custom overrides`,
          confidence: 0.9,
          reasoning: `${pattern.affectedUsers.length} users with role "${pattern.baseRole}" have identical permission overrides. Creating "${pattern.suggestedNewRole.name}" will simplify permission management.`,
        });
      } else if (pattern.driftType === 'EXCESSIVE_OVERRIDES') {
        recommendations.push({
          patternId: pattern.id,
          action: 'REVIEW_MANUALLY',
          impact: `1 user with ${Object.keys(pattern.commonOverrides).length} custom overrides`,
          confidence: 0.6,
          reasoning: `User "${pattern.affectedUsers[0].username}" has ${Object.keys(pattern.commonOverrides).length} custom overrides. Consider creating a custom role or reviewing permissions.`,
        });
      }
    }

    return recommendations;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Clean up expired rollback history
   */
  cleanupExpiredHistory(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [id, history] of this.refactorHistory.entries()) {
      if (now > history.expiresAt) {
        this.refactorHistory.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('[RoleDriftDetection] Cleaned up expired rollback history', { count: cleaned });
    }

    return cleaned;
  }
}

// Export singleton instance
export const roleDriftDetectionService = new RoleDriftDetectionService();
