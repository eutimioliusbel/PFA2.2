# ADR-005 Phase 7: Tasks 7.4-7.5 Complete Prompt Bundles

**Generated**: 2025-11-27
**Status**: Ready for Implementation

---

## 🛠️ Task 7.4: Role Drift Detection (UC 19)

**Agent**: `ai-systems-architect`

**Input Dependencies**:
- ✅ Phase 2 complete (authorization backend)
- ✅ Phase 6 complete (AI foundation)

**Output Deliverables**:
- 📄 RoleDriftService.ts - ML pattern detection
- 📄 Weekly drift analysis job
- 📄 Role refactoring API endpoints
- 📄 Rollback mechanism

**Acceptance Criteria**:
- ✅ Detects 5+ users with identical overrides
- ✅ Suggests new role templates
- ✅ Migrates users with rollback option
- ✅ Weekly reports sent to admins

---

### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@ai-systems-architect

**SYSTEM CONTEXT**:
You are executing Phase 7, Task 7.4 of ADR-005.
Phase 6 complete (AI permission suggestion engine working).

**BUSINESS CONTEXT** (from DECISION.md):
Problem: As organizations grow, permission sprawl occurs. Field Engineers get promoted and receive identical custom overrides (canManageUsers, canManageSettings, viewFinancialDetails). Instead of maintaining 15 custom overrides, create a "Senior Field Engineer" role template.

Use Case: Admin sees AI recommendation: "5 out of 12 Field Engineers (42%) have identical overrides. Create 'Senior Field Engineer' role?"

**TECHNICAL SPECIFICATION**:

```typescript
// File: backend/src/services/ai/RoleDriftService.ts

import { PrismaClient } from '@prisma/client';
import { callAI } from './aiProviderClient';

const prisma = new PrismaClient();

interface RoleDriftPattern {
  id: string;
  baseRole: string;
  driftType: 'CONSISTENT_OVERRIDES' | 'PERMISSION_BLOAT' | 'UNUSED_PERMISSIONS';
  affectedUsers: string[];
  commonOverrides: Record<string, boolean>;
  frequency: string;
  suggestedNewRole: {
    name: string;
    inheritsFrom: string;
    additionalCapabilities: string[];
    description: string;
    estimatedCoverage: string;
  };
  benefit: string;
  confidence: number;
}

interface RoleDriftAnalysis {
  driftDetected: boolean;
  patterns: RoleDriftPattern[];
  recommendations: {
    action: string;
    impact: string;
    effort: string;
    risk: 'LOW' | 'MEDIUM' | 'HIGH';
  }[];
}

export class RoleDriftService {
  /**
   * Detect role drift patterns across organization
   *
   * Analyzes user capability overrides to find consistent patterns
   * that indicate a new role template should be created.
   *
   * @param organizationId - Organization to analyze
   * @returns Drift analysis with recommendations
   */
  async detectRoleDrift(params: {
    organizationId: string;
  }): Promise<RoleDriftAnalysis> {
    // Step 1: Group users by base role
    const usersByRole = await prisma.userOrganization.groupBy({
      by: ['role'],
      where: { organizationId: params.organizationId },
      _count: { userId: true }
    });

    const patterns: RoleDriftPattern[] = [];

    // Step 2: For each role, analyze capability overrides
    for (const roleGroup of usersByRole) {
      const users = await prisma.userOrganization.findMany({
        where: {
          organizationId: params.organizationId,
          role: roleGroup.role
        },
        select: {
          userId: true,
          capabilities: true,
          user: { select: { username: true } }
        }
      });

      // Step 3: Find common override patterns
      const overrideMap = new Map<string, { users: string[], count: number }>();

      for (const user of users) {
        if (!user.capabilities) continue;

        // Serialize capabilities to detect identical patterns
        const capabilitiesJson = JSON.stringify(user.capabilities, Object.keys(user.capabilities).sort());

        if (!overrideMap.has(capabilitiesJson)) {
          overrideMap.set(capabilitiesJson, { users: [], count: 0 });
        }

        const entry = overrideMap.get(capabilitiesJson)!;
        entry.users.push(user.userId);
        entry.count++;
      }

      // Step 4: Identify patterns affecting 30%+ of users (min 5 users)
      for (const [capabilitiesJson, { users: affectedUsers, count }] of overrideMap.entries()) {
        const percentage = (count / users.length) * 100;

        if (count >= 5 && percentage >= 30) {
          const commonOverrides = JSON.parse(capabilitiesJson);

          // Step 5: Use AI to suggest role name and description
          const aiSuggestion = await this.generateRoleSuggestion({
            baseRole: roleGroup.role,
            overrides: commonOverrides,
            userCount: count
          });

          patterns.push({
            id: `pattern-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            baseRole: roleGroup.role,
            driftType: 'CONSISTENT_OVERRIDES',
            affectedUsers,
            commonOverrides,
            frequency: `${count} out of ${users.length} ${roleGroup.role}s (${percentage.toFixed(0)}%)`,
            suggestedNewRole: aiSuggestion,
            benefit: `Simplifies permission management, reduces ${count * Object.keys(commonOverrides).length} custom overrides`,
            confidence: 0.91
          });
        }
      }
    }

    // Step 6: Generate recommendations
    const recommendations = patterns.map(pattern => ({
      action: `Create '${pattern.suggestedNewRole.name}' role`,
      impact: `Migrate ${pattern.affectedUsers.length} users from '${pattern.baseRole} + overrides' to new role`,
      effort: '5 minutes',
      risk: 'LOW' as const
    }));

    return {
      driftDetected: patterns.length > 0,
      patterns,
      recommendations
    };
  }

  /**
   * Generate role name and description using AI
   */
  private async generateRoleSuggestion(params: {
    baseRole: string;
    overrides: Record<string, boolean>;
    userCount: number;
  }): Promise<RoleDriftPattern['suggestedNewRole']> {
    const prompt = `
You are analyzing role permission patterns in a construction project management system.

Base Role: ${params.baseRole}
Common Permission Overrides: ${JSON.stringify(params.overrides, null, 2)}
Users Affected: ${params.userCount}

Suggest a new role name that:
1. Indicates seniority or specialization
2. Clearly inherits from the base role
3. Describes additional capabilities concisely

Format your response as JSON:
{
  "name": "Suggested Role Name",
  "description": "One-sentence description of this role"
}
`;

    const aiResponse = await callAI({
      provider: 'openai',
      model: 'gpt-4',
      prompt,
      maxTokens: 200
    });

    const suggestion = JSON.parse(aiResponse.choices[0].message.content);

    return {
      name: suggestion.name,
      inheritsFrom: params.baseRole,
      additionalCapabilities: Object.keys(params.overrides),
      description: suggestion.description,
      estimatedCoverage: `${((params.userCount / 100) * 100).toFixed(0)}% of current ${params.baseRole}s`
    };
  }

  /**
   * Apply role refactoring recommendation
   *
   * Creates new role template and migrates users.
   * Stores rollback data for 7-day recovery window.
   */
  async applyRoleRefactor(params: {
    patternId: string;
    approve: boolean;
    adminUserId: string;
  }): Promise<{
    newRoleCreated: { id: string; name: string; capabilities: Record<string, boolean> };
    usersMigrated: number;
    overridesRemoved: number;
    auditLogEntries: string[];
    rollbackAvailable: boolean;
    rollbackExpiresAt: string;
  }> {
    if (!params.approve) {
      throw new Error('Approval required to apply role refactor');
    }

    // In production, retrieve pattern from temporary storage
    // For now, this is a placeholder implementation

    // Step 1: Create new role template
    const newRole = await prisma.roleTemplate.create({
      data: {
        name: 'Senior Field Engineer', // From pattern
        inheritsFrom: 'Field Engineer',
        capabilities: {
          canManageUsers: true,
          canManageSettings: true,
          viewFinancialDetails: true
        },
        createdBy: params.adminUserId,
        createdAt: new Date()
      }
    });

    // Step 2: Migrate users (store original state for rollback)
    const affectedUserIds = ['user-101', 'user-102', 'user-103', 'user-104', 'user-105']; // From pattern
    let usersMigrated = 0;
    let overridesRemoved = 0;
    const auditLogEntries: string[] = [];

    for (const userId of affectedUserIds) {
      // Store rollback data
      const originalUserOrg = await prisma.userOrganization.findUnique({
        where: { userId_organizationId: { userId, organizationId: 'org-456' } }
      });

      await prisma.rollbackLog.create({
        data: {
          refactorId: `refactor-${newRole.id}`,
          userId,
          organizationId: 'org-456',
          originalRole: originalUserOrg!.role,
          originalCapabilities: originalUserOrg!.capabilities,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      });

      // Migrate user to new role
      await prisma.userOrganization.update({
        where: { userId_organizationId: { userId, organizationId: 'org-456' } },
        data: {
          role: newRole.name,
          capabilities: null // Clear overrides
        }
      });

      usersMigrated++;
      overridesRemoved += Object.keys(originalUserOrg!.capabilities || {}).length;

      // Create audit log
      const auditEntry = await prisma.auditLog.create({
        data: {
          action: 'ROLE_REFACTOR',
          userId,
          performedBy: params.adminUserId,
          details: `Migrated from '${originalUserOrg!.role} + overrides' to '${newRole.name}'`,
          timestamp: new Date()
        }
      });

      auditLogEntries.push(auditEntry.id);
    }

    // Step 3: Send notifications to affected users
    // (Email/Slack integration placeholder)

    return {
      newRoleCreated: {
        id: newRole.id,
        name: newRole.name,
        capabilities: newRole.capabilities as Record<string, boolean>
      },
      usersMigrated,
      overridesRemoved,
      auditLogEntries,
      rollbackAvailable: true,
      rollbackExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };
  }

  /**
   * Rollback role refactoring
   *
   * Reverts users to original roles and deletes new role template.
   * Only available within 7-day window.
   */
  async rollbackRoleRefactor(params: {
    refactorId: string;
    adminUserId: string;
  }): Promise<{
    success: boolean;
    usersReverted: number;
    roleDeleted: boolean;
  }> {
    // Step 1: Retrieve rollback data
    const rollbackLogs = await prisma.rollbackLog.findMany({
      where: {
        refactorId: params.refactorId,
        expiresAt: { gte: new Date() } // Not expired
      }
    });

    if (rollbackLogs.length === 0) {
      throw new Error('Rollback window expired or refactor not found');
    }

    let usersReverted = 0;

    // Step 2: Revert each user
    for (const log of rollbackLogs) {
      await prisma.userOrganization.update({
        where: {
          userId_organizationId: {
            userId: log.userId,
            organizationId: log.organizationId
          }
        },
        data: {
          role: log.originalRole,
          capabilities: log.originalCapabilities
        }
      });

      usersReverted++;
    }

    // Step 3: Delete new role template
    const roleId = params.refactorId.replace('refactor-', '');
    await prisma.roleTemplate.delete({ where: { id: roleId } });

    // Step 4: Clean up rollback logs
    await prisma.rollbackLog.deleteMany({ where: { refactorId: params.refactorId } });

    return {
      success: true,
      usersReverted,
      roleDeleted: true
    };
  }

  /**
   * Weekly job: Analyze all organizations for drift
   */
  async weeklyDriftReport(): Promise<void> {
    const orgs = await prisma.organization.findMany({
      where: { serviceStatus: 'active' }
    });

    for (const org of orgs) {
      const driftAnalysis = await this.detectRoleDrift({ organizationId: org.id });

      if (driftAnalysis.driftDetected) {
        // Send email to org admins
        const admins = await prisma.userOrganization.findMany({
          where: {
            organizationId: org.id,
            canManageUsers: true
          },
          include: { user: true }
        });

        // Email template (placeholder)
        console.log(`Sending drift report to ${admins.length} admins for ${org.code}`);
        console.log(`Patterns detected: ${driftAnalysis.patterns.length}`);
      }
    }
  }
}

// API Endpoints
// File: backend/src/routes/aiRoutes.ts

router.post('/ai/detect-role-drift', async (req, res) => {
  const { organizationId } = req.body;
  const service = new RoleDriftService();
  const analysis = await service.detectRoleDrift({ organizationId });
  res.json(analysis);
});

router.post('/ai/apply-role-refactor', async (req, res) => {
  const { patternId, approve, adminUserId } = req.body;
  const service = new RoleDriftService();
  const result = await service.applyRoleRefactor({ patternId, approve, adminUserId });
  res.json(result);
});

router.post('/ai/rollback-role-refactor', async (req, res) => {
  const { refactorId, adminUserId } = req.body;
  const service = new RoleDriftService();
  const result = await service.rollbackRoleRefactor({ refactorId, adminUserId });
  res.json(result);
});
```

**Database Schema Additions**:

```prisma
// File: backend/prisma/schema.prisma

model RoleTemplate {
  id            String   @id @default(cuid())
  name          String
  inheritsFrom  String?
  capabilities  Json     // { canRead: true, canWrite: true, ... }
  createdBy     String
  createdAt     DateTime @default(now())
}

model RollbackLog {
  id                    String   @id @default(cuid())
  refactorId            String
  userId                String
  organizationId        String
  originalRole          String
  originalCapabilities  Json?
  expiresAt             DateTime
  createdAt             DateTime @default(now())

  @@index([refactorId, expiresAt])
}
```

**Weekly Cron Job**:

```typescript
// File: backend/src/jobs/weeklyDriftReport.ts

import { RoleDriftService } from '../services/ai/RoleDriftService';

export async function runWeeklyDriftReport() {
  const service = new RoleDriftService();
  await service.weeklyDriftReport();
}

// Schedule: Every Monday at 9 AM
// In backend/src/server.ts:
import cron from 'node-cron';
cron.schedule('0 9 * * 1', runWeeklyDriftReport);
```

**AI ENFORCEMENT** (from AI_OPPORTUNITIES.md):
🚨 **MANDATORY**: Use AI to suggest role names based on base role + overrides.
🚨 **MANDATORY**: Detect patterns affecting 30%+ of users (minimum 5 users).
🚨 **MANDATORY**: Store rollback data for 7-day recovery window.
🚨 **MANDATORY**: Send weekly drift reports to organization admins.

**UX ENFORCEMENT** (from UX_SPEC.md):
🚨 **MANDATORY**: Display AI recommendation cards in admin dashboard.
🚨 **MANDATORY**: Show preview modal before applying refactor.
🚨 **MANDATORY**: Include rollback option in success message.
🚨 **MANDATORY**: Use blue button for "Apply Recommendation".

**YOUR MISSION**:

**Step 1**: Create RoleDriftService.ts with detectRoleDrift() method
- Group users by role
- Find identical override patterns
- Use AI to suggest role names
- Calculate impact and confidence scores

**Step 2**: Implement applyRoleRefactor() method
- Create new role template
- Migrate users to new role
- Store rollback data (7-day expiry)
- Create audit log entries

**Step 3**: Implement rollbackRoleRefactor() method
- Retrieve rollback logs (check expiry)
- Revert users to original roles
- Delete new role template
- Clean up rollback logs

**Step 4**: Create weekly drift report cron job
- Analyze all active organizations
- Send email to admins if drift detected
- Schedule every Monday at 9 AM

**Step 5**: Add RoleTemplate and RollbackLog database models
- Create Prisma migration
- Add indexes for performance

**Step 6**: Create API endpoints
- POST /api/ai/detect-role-drift
- POST /api/ai/apply-role-refactor
- POST /api/ai/rollback-role-refactor

**DELIVERABLES**:
1. backend/src/services/ai/RoleDriftService.ts (200+ lines)
2. backend/src/routes/aiRoutes.ts (role drift endpoints)
3. backend/src/jobs/weeklyDriftReport.ts
4. backend/prisma/schema.prisma (RoleTemplate, RollbackLog models)
5. backend/prisma/migrations/add_role_drift_tracking.sql

**CONSTRAINTS**:
- ❌ Do NOT suggest roles for patterns <30% coverage
- ❌ Do NOT allow rollback after 7-day expiry
- ❌ Do NOT migrate users without admin approval
- ❌ Do NOT delete rollback logs until expiry
- ✅ DO use AI to generate role names and descriptions
- ✅ DO store original state before migration
- ✅ DO create audit log entries for all changes
- ✅ DO send notifications to affected users

**VERIFICATION QUESTIONS**:
1. Does detectRoleDrift() correctly identify 5+ users with identical overrides?
2. Does AI suggest logical role names (e.g., "Senior Field Engineer")?
3. Does applyRoleRefactor() store rollback data with 7-day expiry?
4. Can admins successfully rollback within 7 days?
5. Does weeklyDriftReport() send emails to org admins?
6. Are false positives prevented (users with different override combinations)?
```

**Status**: ⬜ Not Started

---

## 🛠️ Task 7.5: Behavioral Quiet Mode (UC 20)

**Agent**: `ux-technologist`

**Input Dependencies**:
- ✅ Phase 6 complete (AI foundation)
- ✅ Notification system exists

**Output Deliverables**:
- 📄 NotificationRouterService.ts - AI engagement learning
- 📄 User attention pattern detection
- 📄 Smart notification deferral
- 📄 Notification digest UI

**Acceptance Criteria**:
- ✅ Detects user quiet hours (no activity 10+ min)
- ✅ Defers routine notifications to peak attention time
- ✅ Batches deferred notifications into digest
- ✅ Learns from user engagement patterns

---

### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@ux-technologist

**SYSTEM CONTEXT**:
You are executing Phase 7, Task 7.5 of ADR-005.
Phase 6 complete (AI foundation working).

**BUSINESS CONTEXT** (from DECISION.md):
Problem: Users receive 25+ notifications per day. Most are ignored during focus work (8-12 AM). Important updates get lost in noise. Users report notification fatigue.

Use Case: AI learns User X never reads notifications between 8 AM - 12 PM (focused work time) but engages with notifications sent between 2 PM - 4 PM. AI automatically delays non-urgent notifications to optimal times.

Goal: Reduce notification saturation from 25/day to optimal range (10-15/day) by batching low-priority updates into digest.

**TECHNICAL SPECIFICATION**:

```typescript
// File: backend/src/services/ai/NotificationRouterService.ts

import { PrismaClient } from '@prisma/client';
import { callAI } from './aiProviderClient';

const prisma = new PrismaClient();

interface EngagementProfile {
  peakAttentionHours: string[];
  quietHours: string[];
  preferredChannels: {
    urgent: 'slack' | 'email' | 'in_app';
    routine: 'slack' | 'email' | 'in_app';
    fyi: 'slack' | 'email' | 'in_app';
  };
  avgResponseTime: {
    urgent: string;
    routine: string;
    fyi: string;
  };
  notificationSaturation: {
    current: number;
    optimalRange: string;
    status: 'OK' | 'OVERLOADED' | 'UNDERUTILIZED';
    recommendation: string;
  };
}

interface RoutingDecision {
  action: 'SEND_NOW' | 'DEFER' | 'SEND_NOW_WITH_BADGE';
  deferUntil?: string;
  channel: 'slack' | 'email' | 'in_app';
  reasoning: string;
  alternativeOption?: {
    action: string;
    reasoning: string;
  };
}

export class NotificationRouterService {
  /**
   * Learn user attention patterns from historical engagement
   *
   * Analyzes when user clicks/reads notifications, response times,
   * and activity patterns to build engagement profile.
   */
  async learnNotificationPreferences(params: {
    userId: string;
  }): Promise<{
    engagementProfile: EngagementProfile;
    confidence: number;
    dataSince: string;
  }> {
    // Step 1: Retrieve notification engagement history (past 90 days)
    const engagementHistory = await prisma.notificationEngagement.findMany({
      where: {
        userId: params.userId,
        timestamp: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    if (engagementHistory.length < 50) {
      // Not enough data - return defaults
      return {
        engagementProfile: this.getDefaultProfile(),
        confidence: 0.4,
        dataSince: new Date().toISOString()
      };
    }

    // Step 2: Analyze engagement by hour of day
    const engagementByHour = new Map<number, { sent: number, read: number, responseTime: number[] }>();

    for (let hour = 0; hour < 24; hour++) {
      engagementByHour.set(hour, { sent: 0, read: 0, responseTime: [] });
    }

    for (const engagement of engagementHistory) {
      const hour = new Date(engagement.timestamp).getHours();
      const stats = engagementByHour.get(hour)!;

      stats.sent++;
      if (engagement.readAt) {
        stats.read++;
        const responseTime = new Date(engagement.readAt).getTime() - new Date(engagement.timestamp).getTime();
        stats.responseTime.push(responseTime);
      }
    }

    // Step 3: Identify peak attention hours (read rate >60%)
    const peakAttentionHours: string[] = [];
    const quietHours: string[] = [];

    for (const [hour, stats] of engagementByHour.entries()) {
      if (stats.sent < 5) continue; // Insufficient data

      const readRate = stats.read / stats.sent;

      if (readRate > 0.6) {
        // Peak attention (e.g., 14:00-16:00)
        peakAttentionHours.push(`${hour.toString().padStart(2, '0')}:00-${(hour + 1).toString().padStart(2, '0')}:00`);
      } else if (readRate < 0.2) {
        // Quiet hours (user ignores notifications)
        quietHours.push(`${hour.toString().padStart(2, '0')}:00-${(hour + 1).toString().padStart(2, '0')}:00`);
      }
    }

    // Step 4: Analyze channel preferences (which channels get fastest responses?)
    const channelEngagement = {
      slack: { sent: 0, avgResponseTime: 0 },
      email: { sent: 0, avgResponseTime: 0 },
      in_app: { sent: 0, avgResponseTime: 0 }
    };

    for (const engagement of engagementHistory) {
      const channel = engagement.channel as keyof typeof channelEngagement;
      channelEngagement[channel].sent++;

      if (engagement.readAt) {
        const responseTime = new Date(engagement.readAt).getTime() - new Date(engagement.timestamp).getTime();
        channelEngagement[channel].avgResponseTime += responseTime;
      }
    }

    // Calculate average response times
    for (const channel of Object.keys(channelEngagement) as Array<keyof typeof channelEngagement>) {
      const stats = channelEngagement[channel];
      if (stats.sent > 0) {
        stats.avgResponseTime = stats.avgResponseTime / stats.sent;
      }
    }

    // Step 5: Determine preferred channels by urgency
    const preferredChannels = {
      urgent: 'slack' as const, // Fastest response
      routine: 'in_app' as const,
      fyi: 'email' as const
    };

    // Find fastest channel
    let fastestChannel: 'slack' | 'email' | 'in_app' = 'slack';
    let fastestTime = Infinity;

    for (const [channel, stats] of Object.entries(channelEngagement)) {
      if (stats.avgResponseTime < fastestTime && stats.sent > 10) {
        fastestChannel = channel as 'slack' | 'email' | 'in_app';
        fastestTime = stats.avgResponseTime;
      }
    }

    preferredChannels.urgent = fastestChannel;

    // Step 6: Calculate notification saturation
    const currentSaturation = await prisma.notificationEngagement.count({
      where: {
        userId: params.userId,
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });

    let saturationStatus: 'OK' | 'OVERLOADED' | 'UNDERUTILIZED' = 'OK';
    let recommendation = '';

    if (currentSaturation > 20) {
      saturationStatus = 'OVERLOADED';
      recommendation = `Reduce non-urgent notifications by ${Math.round(((currentSaturation - 15) / currentSaturation) * 100)}%`;
    } else if (currentSaturation < 5) {
      saturationStatus = 'UNDERUTILIZED';
      recommendation = 'User engagement is low. Consider increasing notification relevance.';
    }

    return {
      engagementProfile: {
        peakAttentionHours,
        quietHours,
        preferredChannels,
        avgResponseTime: {
          urgent: this.formatDuration(channelEngagement[fastestChannel].avgResponseTime),
          routine: this.formatDuration(channelEngagement.in_app.avgResponseTime || 4 * 60 * 60 * 1000),
          fyi: this.formatDuration(channelEngagement.email.avgResponseTime || 2 * 24 * 60 * 60 * 1000)
        },
        notificationSaturation: {
          current: currentSaturation,
          optimalRange: '10-15 per day',
          status: saturationStatus,
          recommendation
        }
      },
      confidence: Math.min(0.95, engagementHistory.length / 200), // Max 95% confidence
      dataSince: engagementHistory[engagementHistory.length - 1].timestamp.toISOString()
    };
  }

  /**
   * Smart notification routing based on user engagement patterns
   *
   * Decides whether to send now, defer, or batch into digest.
   */
  async routeNotification(params: {
    userId: string;
    notification: {
      type: string;
      urgency: 'urgent' | 'routine' | 'fyi';
      content: string;
    };
    timestamp: string;
  }): Promise<{ routingDecision: RoutingDecision; confidence: number }> {
    // Step 1: Load user engagement profile
    const { engagementProfile, confidence } = await this.learnNotificationPreferences({ userId: params.userId });

    // Step 2: Determine current hour
    const currentHour = new Date(params.timestamp).getHours();
    const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:00-${(currentHour + 1).toString().padStart(2, '0')}:00`;

    // Step 3: Check if user is in quiet hours
    const isQuietHour = engagementProfile.quietHours.includes(currentTimeStr);

    // Step 4: Routing logic based on urgency and quiet hours
    let routingDecision: RoutingDecision;

    if (params.notification.urgency === 'urgent') {
      // Always send urgent notifications immediately
      routingDecision = {
        action: 'SEND_NOW',
        channel: engagementProfile.preferredChannels.urgent,
        reasoning: 'Urgent notification. User prefers immediate delivery via ' + engagementProfile.preferredChannels.urgent
      };
    } else if (isQuietHour && params.notification.urgency === 'routine') {
      // Defer routine notifications during quiet hours
      const peakHour = engagementProfile.peakAttentionHours[0]; // First peak hour

      if (!peakHour) {
        // No peak hours identified - send as low-priority badge
        routingDecision = {
          action: 'SEND_NOW_WITH_BADGE',
          channel: 'in_app',
          reasoning: 'User is in quiet hours. No peak attention hours identified. Send as low-priority badge.'
        };
      } else {
        // Defer to peak attention time
        const peakHourNum = parseInt(peakHour.split(':')[0]);
        const deferUntil = new Date(params.timestamp);
        deferUntil.setHours(peakHourNum, 0, 0, 0);

        // If peak hour already passed today, defer to tomorrow
        if (deferUntil.getTime() < new Date(params.timestamp).getTime()) {
          deferUntil.setDate(deferUntil.getDate() + 1);
        }

        routingDecision = {
          action: 'DEFER',
          deferUntil: deferUntil.toISOString(),
          channel: engagementProfile.preferredChannels.routine,
          reasoning: `User is in quiet hours (${currentTimeStr}). This is a routine notification. Defer to peak attention time (${peakHour}).`,
          alternativeOption: {
            action: 'SEND_NOW_WITH_BADGE',
            reasoning: 'Send now but as a low-priority badge. User can acknowledge when ready.'
          }
        };
      }
    } else if (params.notification.urgency === 'fyi') {
      // Always defer FYI notifications to digest
      routingDecision = {
        action: 'DEFER',
        deferUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        channel: 'in_app',
        reasoning: 'FYI notification. Batch into daily digest.',
        alternativeOption: {
          action: 'SEND_NOW_WITH_BADGE',
          reasoning: 'Send as low-priority badge if digest is disabled.'
        }
      };
    } else {
      // Send routine notifications during non-quiet hours
      routingDecision = {
        action: 'SEND_NOW',
        channel: engagementProfile.preferredChannels.routine,
        reasoning: 'User is active. Send routine notification via ' + engagementProfile.preferredChannels.routine
      };
    }

    return { routingDecision, confidence };
  }

  /**
   * Generate notification digest for deferred notifications
   *
   * Batches low-priority notifications into a single summary.
   */
  async generateNotificationDigest(params: {
    userId: string;
    sendAt: string;
  }): Promise<{
    digest: {
      title: string;
      summary: string;
      priorityItems: Array<{ notification: string; action: string }>;
      routineItems: Array<{ notification: string }>;
      fyiItems: Array<{ notification: string }>;
    };
    deferredCount: number;
  }> {
    // Step 1: Retrieve deferred notifications
    const deferredNotifications = await prisma.deferredNotification.findMany({
      where: {
        userId: params.userId,
        deferUntil: { lte: new Date(params.sendAt) },
        status: 'pending'
      },
      orderBy: { createdAt: 'desc' }
    });

    // Step 2: Categorize by urgency
    const priorityItems: Array<{ notification: string; action: string }> = [];
    const routineItems: Array<{ notification: string }> = [];
    const fyiItems: Array<{ notification: string }> = [];

    for (const notif of deferredNotifications) {
      if (notif.urgency === 'urgent') {
        priorityItems.push({
          notification: notif.content,
          action: notif.actionUrl || 'View Details'
        });
      } else if (notif.urgency === 'routine') {
        routineItems.push({ notification: notif.content });
      } else {
        fyiItems.push({ notification: notif.content });
      }
    }

    // Step 3: Generate summary
    const summary = `${priorityItems.length} permission changes, ${routineItems.length} sync completions, ${fyiItems.length} new comments`;

    // Step 4: Mark notifications as sent
    await prisma.deferredNotification.updateMany({
      where: { userId: params.userId, deferUntil: { lte: new Date(params.sendAt) } },
      data: { status: 'sent' }
    });

    return {
      digest: {
        title: `${deferredNotifications.length} updates while you were focused`,
        summary,
        priorityItems,
        routineItems,
        fyiItems
      },
      deferredCount: deferredNotifications.length
    };
  }

  /**
   * Detect user focus periods (no activity for 10+ minutes)
   */
  async detectFocusMode(params: {
    userId: string;
  }): Promise<{ inFocusMode: boolean; focusStartedAt?: string }> {
    const lastActivity = await prisma.userActivity.findFirst({
      where: { userId: params.userId },
      orderBy: { timestamp: 'desc' }
    });

    if (!lastActivity) {
      return { inFocusMode: false };
    }

    const minutesSinceActivity = (Date.now() - lastActivity.timestamp.getTime()) / (1000 * 60);

    if (minutesSinceActivity >= 10) {
      return {
        inFocusMode: true,
        focusStartedAt: new Date(lastActivity.timestamp.getTime() + 10 * 60 * 1000).toISOString()
      };
    }

    return { inFocusMode: false };
  }

  private getDefaultProfile(): EngagementProfile {
    return {
      peakAttentionHours: ['14:00-16:00', '19:00-21:00'],
      quietHours: ['08:00-12:00', '00:00-07:00'],
      preferredChannels: {
        urgent: 'slack',
        routine: 'in_app',
        fyi: 'email'
      },
      avgResponseTime: {
        urgent: '15 minutes',
        routine: '4 hours',
        fyi: '2 days'
      },
      notificationSaturation: {
        current: 0,
        optimalRange: '10-15 per day',
        status: 'OK',
        recommendation: 'No action needed'
      }
    };
  }

  private formatDuration(ms: number): string {
    const minutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
}

// API Endpoints
// File: backend/src/routes/aiRoutes.ts

router.post('/ai/learn-notification-preferences', async (req, res) => {
  const { userId } = req.body;
  const service = new NotificationRouterService();
  const result = await service.learnNotificationPreferences({ userId });
  res.json(result);
});

router.post('/ai/route-notification', async (req, res) => {
  const { userId, notification, timestamp } = req.body;
  const service = new NotificationRouterService();
  const result = await service.routeNotification({ userId, notification, timestamp });
  res.json(result);
});

router.post('/ai/generate-notification-digest', async (req, res) => {
  const { userId, sendAt } = req.body;
  const service = new NotificationRouterService();
  const result = await service.generateNotificationDigest({ userId, sendAt });
  res.json(result);
});
```

**Frontend UI Component**:

```tsx
// File: components/user/NotificationPreferences.tsx

export function NotificationPreferences() {
  const [profile, setProfile] = useState<EngagementProfile | null>(null);
  const [smartDeliveryEnabled, setSmartDeliveryEnabled] = useState(true);

  useEffect(() => {
    loadEngagementProfile();
  }, []);

  const loadEngagementProfile = async () => {
    const data = await apiClient.learnNotificationPreferences(currentUser.id);
    setProfile(data.engagementProfile);
  };

  return (
    <div className="notification-preferences">
      <h2>🔔 Notification Preferences</h2>

      <div className="smart-delivery-toggle">
        <label>
          <input
            type="checkbox"
            checked={smartDeliveryEnabled}
            onChange={(e) => setSmartDeliveryEnabled(e.target.checked)}
          />
          AI-Powered Smart Delivery (Recommended)
        </label>
      </div>

      {profile && (
        <>
          <div className="ai-insight">
            🤖 AI has learned your attention patterns over the past 4 months
          </div>

          <div className="peak-hours">
            <h3>Your Peak Attention Hours:</h3>
            {profile.peakAttentionHours.map(hour => (
              <div key={hour} className="hour-badge peak">
                🌞 {hour} (High) ✅
              </div>
            ))}
            {profile.quietHours.slice(0, 2).map(hour => (
              <div key={hour} className="hour-badge quiet">
                🌅 {hour} (Low)
              </div>
            ))}
          </div>

          <div className="saturation-meter">
            <h3>Notification Saturation:</h3>
            <div className="meter-bar">
              <div
                className="meter-fill"
                style={{ width: `${(profile.notificationSaturation.current / 30) * 100}%` }}
              />
            </div>
            <div className="meter-label">
              {profile.notificationSaturation.current}/day ({profile.notificationSaturation.status})
            </div>
            <div className="optimal-range">
              Optimal: {profile.notificationSaturation.optimalRange}
            </div>
            {profile.notificationSaturation.recommendation && (
              <div className="recommendation">
                💡 AI Recommendation: {profile.notificationSaturation.recommendation}
              </div>
            )}
          </div>

          <div className="channel-preferences">
            <h3>Channel Preferences:</h3>
            <ul>
              <li>• Urgent: {profile.preferredChannels.urgent} ✅</li>
              <li>• Routine: {profile.preferredChannels.routine}</li>
              <li>• FYI: {profile.preferredChannels.fyi}</li>
            </ul>
          </div>
        </>
      )}

      <div className="actions">
        <button onClick={loadEngagementProfile}>Customize</button>
        <button>Reset to Defaults</button>
      </div>
    </div>
  );
}
```

**Notification Digest Component**:

```tsx
// File: components/NotificationDigest.tsx

export function NotificationDigest({ digest }: { digest: NotificationDigestData }) {
  return (
    <div className="notification-digest">
      <h2>📬 {digest.title}</h2>

      <div className="summary">{digest.summary}</div>

      {digest.priorityItems.length > 0 && (
        <div className="priority-section">
          <h3>Priority ({digest.priorityItems.length}):</h3>
          <ul>
            {digest.priorityItems.map((item, i) => (
              <li key={i}>
                • {item.notification}
                <a href="#">[{item.action}]</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {digest.routineItems.length > 0 && (
        <div className="routine-section">
          <h3>Routine ({digest.routineItems.length}):</h3>
          <ul>
            {digest.routineItems.slice(0, 3).map((item, i) => (
              <li key={i}>• {item.notification}</li>
            ))}
            {digest.routineItems.length > 3 && (
              <li>... ({digest.routineItems.length - 3} more) <a href="#">[View All]</a></li>
            )}
          </ul>
        </div>
      )}

      <div className="actions">
        <button>Mark All Read</button>
        <button>Notification Settings</button>
      </div>
    </div>
  );
}
```

**Database Schema Additions**:

```prisma
// File: backend/prisma/schema.prisma

model NotificationEngagement {
  id          String   @id @default(cuid())
  userId      String
  channel     String   // 'slack', 'email', 'in_app'
  timestamp   DateTime
  readAt      DateTime?
  clickedAt   DateTime?
  urgency     String   // 'urgent', 'routine', 'fyi'

  @@index([userId, timestamp])
}

model DeferredNotification {
  id         String   @id @default(cuid())
  userId     String
  content    String
  urgency    String
  deferUntil DateTime
  status     String   @default("pending") // 'pending', 'sent'
  actionUrl  String?
  createdAt  DateTime @default(now())

  @@index([userId, deferUntil, status])
}

model UserActivity {
  id        String   @id @default(cuid())
  userId    String
  action    String   // 'click', 'scroll', 'type', etc.
  timestamp DateTime

  @@index([userId, timestamp])
}
```

**AI ENFORCEMENT** (from AI_OPPORTUNITIES.md):
🚨 **MANDATORY**: Learn engagement patterns from ≥50 historical notifications.
🚨 **MANDATORY**: Identify peak attention hours (read rate >60%).
🚨 **MANDATORY**: Defer routine notifications during quiet hours.
🚨 **MANDATORY**: Batch FYI notifications into daily digest.

**UX ENFORCEMENT** (from UX_SPEC.md):
🚨 **MANDATORY**: Display AI insight message: "AI has learned your attention patterns over the past X months".
🚨 **MANDATORY**: Show notification saturation meter with optimal range (10-15/day).
🚨 **MANDATORY**: Use subtle badge for deferred notifications: "🔕 Quiet Mode: 3 pending".
🚨 **MANDATORY**: Group digest by priority (Priority/Routine/FYI sections).

**YOUR MISSION**:

**Step 1**: Create NotificationRouterService.ts with learnNotificationPreferences() method
- Retrieve engagement history (past 90 days)
- Analyze engagement by hour of day
- Identify peak attention hours (read rate >60%)
- Identify quiet hours (read rate <20%)
- Calculate notification saturation

**Step 2**: Implement routeNotification() method
- Load user engagement profile
- Check if user is in quiet hours
- Apply routing logic based on urgency
- Defer routine notifications to peak attention time
- Always send urgent notifications immediately

**Step 3**: Implement generateNotificationDigest() method
- Retrieve deferred notifications
- Categorize by urgency (Priority/Routine/FYI)
- Generate summary text
- Mark notifications as sent

**Step 4**: Implement detectFocusMode() method
- Track user activity (clicks, scrolls, typing)
- Detect when user has no activity for 10+ minutes
- Enable "Quiet Mode" during focus periods

**Step 5**: Create NotificationPreferences.tsx UI component
- Display engagement profile (peak hours, saturation)
- Show AI-powered smart delivery toggle
- Display channel preferences
- Show saturation meter with visual bar

**Step 6**: Create NotificationDigest.tsx UI component
- Display digest title and summary
- Group notifications by urgency
- Provide "Mark All Read" and "Notification Settings" actions
- Show subtle "🔕 Quiet Mode: X pending" badge

**Step 7**: Add database models
- NotificationEngagement (track reads/clicks)
- DeferredNotification (pending notifications)
- UserActivity (detect focus mode)

**DELIVERABLES**:
1. backend/src/services/ai/NotificationRouterService.ts (250+ lines)
2. backend/src/routes/aiRoutes.ts (notification routing endpoints)
3. components/user/NotificationPreferences.tsx
4. components/NotificationDigest.tsx
5. backend/prisma/schema.prisma (NotificationEngagement, DeferredNotification, UserActivity models)
6. backend/prisma/migrations/add_notification_intelligence.sql

**CONSTRAINTS**:
- ❌ Do NOT defer urgent notifications
- ❌ Do NOT use engagement data with <50 notifications
- ❌ Do NOT send digest during quiet hours
- ❌ Do NOT exceed 15 notifications/day for non-urgent
- ✅ DO learn from user engagement patterns
- ✅ DO defer routine notifications during quiet hours
- ✅ DO batch FYI notifications into digest
- ✅ DO show clear AI insight messages

**VERIFICATION QUESTIONS**:
1. Does learnNotificationPreferences() correctly identify peak attention hours?
2. Does routeNotification() defer routine notifications during quiet hours?
3. Does generateNotificationDigest() batch low-priority notifications?
4. Does detectFocusMode() detect 10+ minutes of inactivity?
5. Does NotificationPreferences.tsx display saturation meter correctly?
6. Does NotificationDigest.tsx group notifications by urgency?
7. Are notification counts reduced to optimal range (10-15/day)?
```

**Status**: ⬜ Not Started

---

## 📊 Completion Summary

**Generated**: 2 complete prompt bundles for Phase 7 (Tasks 7.4-7.5)

**Total Lines of Code Specified**:
- Task 7.4 (RoleDriftService): ~300 lines
- Task 7.5 (NotificationRouterService): ~400 lines
- **Total**: ~700 lines

**Agents Assigned**:
- ai-systems-architect (Role Drift Detection)
- ux-technologist (Behavioral Quiet Mode)

**Dependencies**:
- Both tasks require Phase 6 complete (AI foundation)
- Both integrate with existing notification system

**Next Steps**:
1. Paste Task 7.4 prompt bundle to @ai-systems-architect
2. Paste Task 7.5 prompt bundle to @ux-technologist
3. Verify both deliverables integrate with existing Phase 6 AI infrastructure
4. Run integration tests from TEST_PLAN.md (Use Cases 19-20)

---

**Files Created**:
- C:\Projects\PFA2.2\temp\agent-work\2025-11-27-phase7-tasks-4-5-complete.md

**Ready for Implementation**: ✅
