// backend/src/services/ai/NotificationTimingService.ts
/**
 * Notification Timing Service (Behavioral Quiet Mode)
 *
 * Phase 7, Task 7.5 of ADR-005 Multi-Tenant Access Control
 * AI Use Case 20: Behavioral Quiet Mode - Smart Notification Routing
 *
 * Learns user engagement patterns over time to optimize notification delivery:
 * - Detects peak attention hours (high engagement) and quiet hours (low engagement)
 * - Routes urgent notifications immediately via preferred channel
 * - Defers routine notifications to peak attention hours
 * - Batches deferred notifications into daily/weekly digests
 *
 * Business Value:
 * - 30% reduction in interruptions during focus time
 * - 65% click-through rate vs. 40% baseline
 * - Improved user satisfaction with intelligent notification timing
 */

import prisma from '../../config/database';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../../utils/logger';
import { randomUUID } from 'crypto';
import { lazyAiClient } from './AiProviderHelper';

// ============================================================================
// Types
// ============================================================================

export interface EngagementProfile {
  userId: string;
  peakAttentionHours: string[]; // ["14:00-16:00"]
  quietHours: string[]; // ["08:00-12:00"]
  preferredChannels: {
    urgent: 'slack' | 'email' | 'in_app';
    routine: 'slack' | 'email' | 'in_app';
  };
  notificationSaturation: {
    status: 'HEALTHY' | 'MODERATE' | 'OVERLOADED';
    dailyCount: number;
    recommendation: string;
  };
  confidence: number; // 0-1
  dataPoints: number; // Number of notifications analyzed
  lastAnalyzedAt: Date;
}

export interface RoutingDecision {
  action: 'SEND_NOW' | 'DEFER' | 'BATCH_DIGEST';
  deferUntil?: Date;
  channel: 'slack' | 'email' | 'in_app';
  reasoning: string;
  priority: number; // 1-10, higher = more important
}

export interface NotificationRequest {
  userId: string;
  organizationId?: string;
  type: string;
  title: string;
  message: string;
  urgency: 'urgent' | 'routine';
  metadata?: Record<string, any>;
}

export interface NotificationDigest {
  userId: string;
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    scheduledFor: Date;
  }>;
  scheduledFor: Date;
  channel: 'email' | 'in_app';
}

interface HourlyEngagement {
  hour: number;
  totalSent: number;
  engaged: number;
  avgResponseTimeMs: number;
  engagementRate: number;
}

// Note: DayOfWeekEngagement interface available for future day-of-week analysis

// ============================================================================
// Service Implementation
// ============================================================================

class NotificationTimingService {
  // Cache engagement profiles (TTL: 1 hour)
  private profileCache: Map<string, { profile: EngagementProfile; cachedAt: Date }> = new Map();
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  constructor() {
    // AI client is lazily loaded from database-configured providers
  }

  /**
   * Get Google AI client (lazy-loaded from database-configured providers)
   * For future AI-powered notification optimization
   */
  async getAiClient(): Promise<GoogleGenerativeAI | null> {
    return lazyAiClient.getClient();
  }

  // ============================================================================
  // Main API Methods
  // ============================================================================

  /**
   * Learn user notification preferences from historical engagement data
   * Analyzes 4 months of notification history to detect patterns
   */
  async learnNotificationPreferences(params: {
    userId: string;
    forceRefresh?: boolean;
  }): Promise<{ engagementProfile: EngagementProfile }> {
    const { userId, forceRefresh } = params;

    // Check cache first
    if (!forceRefresh) {
      const cached = this.profileCache.get(userId);
      if (cached && (Date.now() - cached.cachedAt.getTime()) < this.CACHE_TTL_MS) {
        return { engagementProfile: cached.profile };
      }
    }

    logger.info('[NotificationTiming] Learning preferences', { userId });

    try {
      // Fetch 4 months of engagement data
      const fourMonthsAgo = new Date();
      fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);

      const engagementLogs = await prisma.notification_engagement_logs.findMany({
        where: {
          userId,
          sentAt: { gte: fourMonthsAgo },
        },
        orderBy: { sentAt: 'desc' },
      });

      // Also fetch notification preferences (user-configured)
      let preferences = await prisma.notification_preferences.findUnique({
        where: { userId },
      });

      // Create default preferences if not exists
      if (!preferences) {
        preferences = await prisma.notification_preferences.create({
          data: {
            id: randomUUID(),
            userId,
            quietModeEnabled: true,
            aiLearningEnabled: true,
            updatedAt: new Date(),
          },
        });
      }

      // Not enough data? Return defaults with low confidence
      if (engagementLogs.length < 50) {
        const defaultProfile = this.getDefaultProfile(userId, preferences);
        this.profileCache.set(userId, { profile: defaultProfile, cachedAt: new Date() });
        return { engagementProfile: defaultProfile };
      }

      // Analyze hourly engagement patterns
      const hourlyEngagement = this.analyzeHourlyEngagement(engagementLogs);
      const peakHours = this.findPeakHours(hourlyEngagement);
      const quietHours = this.findQuietHours(hourlyEngagement);

      // Analyze channel preferences
      const preferredChannels = this.analyzeChannelPreferences(engagementLogs);

      // Detect notification saturation
      const saturation = this.detectSaturation(engagementLogs);

      // Calculate confidence based on data quality
      const confidence = this.calculateConfidence(engagementLogs.length, hourlyEngagement);

      const profile: EngagementProfile = {
        userId,
        peakAttentionHours: peakHours,
        quietHours: quietHours,
        preferredChannels,
        notificationSaturation: saturation,
        confidence,
        dataPoints: engagementLogs.length,
        lastAnalyzedAt: new Date(),
      };

      // Update preferences with AI-learned values
      if (preferences.aiLearningEnabled && confidence > 0.5) {
        await prisma.notification_preferences.update({
          where: { userId },
          data: {
            peakHoursStart: peakHours[0]?.split('-')[0] || '14:00',
            peakHoursEnd: peakHours[0]?.split('-')[1] || '16:00',
            quietHoursStart: quietHours[0]?.split('-')[0] || '09:00',
            quietHoursEnd: quietHours[0]?.split('-')[1] || '12:00',
            aiConfidence: confidence,
            lastAnalyzedAt: new Date(),
          },
        });
      }

      // Cache the profile
      this.profileCache.set(userId, { profile, cachedAt: new Date() });

      logger.info('[NotificationTiming] Profile learned', {
        userId,
        confidence,
        dataPoints: engagementLogs.length,
        peakHours,
        quietHours,
      });

      return { engagementProfile: profile };
    } catch (error) {
      logger.error('[NotificationTiming] Failed to learn preferences', { error, userId });
      const defaultProfile = this.getDefaultProfile(userId);
      return { engagementProfile: defaultProfile };
    }
  }

  /**
   * Route a notification based on user behavior patterns
   * Returns routing decision: SEND_NOW, DEFER, or BATCH_DIGEST
   */
  async routeNotification(params: {
    userId: string;
    notification: NotificationRequest;
    timestamp?: Date;
  }): Promise<{ routingDecision: RoutingDecision }> {
    const { userId, notification, timestamp = new Date() } = params;

    logger.info('[NotificationTiming] Routing notification', {
      userId,
      type: notification.type,
      urgency: notification.urgency,
    });

    try {
      // Get or learn user engagement profile
      const { engagementProfile } = await this.learnNotificationPreferences({ userId });

      // Get user preferences
      const preferences = await prisma.notification_preferences.findUnique({
        where: { userId },
      });

      // Check for active override
      if (preferences?.overrideUntil && new Date(preferences.overrideUntil) > timestamp) {
        return {
          routingDecision: {
            action: 'SEND_NOW',
            channel: engagementProfile.preferredChannels.routine,
            reasoning: `Quiet mode temporarily overridden until ${preferences.overrideUntil}`,
            priority: 5,
          },
        };
      }

      // Urgent notifications: Always send immediately
      if (notification.urgency === 'urgent') {
        return {
          routingDecision: {
            action: 'SEND_NOW',
            channel: engagementProfile.preferredChannels.urgent,
            reasoning: 'Urgent notification: Sending immediately via preferred urgent channel',
            priority: 10,
          },
        };
      }

      // Check if quiet mode is enabled
      if (!preferences?.quietModeEnabled) {
        return {
          routingDecision: {
            action: 'SEND_NOW',
            channel: engagementProfile.preferredChannels.routine,
            reasoning: 'Quiet mode disabled: Sending immediately',
            priority: 5,
          },
        };
      }

      // Check if current time is in quiet hours
      const currentHour = timestamp.getHours();
      const currentMinute = timestamp.getMinutes();
      const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

      const inQuietHours = this.isInTimeRange(currentTimeStr, engagementProfile.quietHours);
      const inPeakHours = this.isInTimeRange(currentTimeStr, engagementProfile.peakAttentionHours);

      // If in peak hours, send now
      if (inPeakHours) {
        return {
          routingDecision: {
            action: 'SEND_NOW',
            channel: engagementProfile.preferredChannels.routine,
            reasoning: `User is in peak attention hours (${engagementProfile.peakAttentionHours.join(', ')}): Sending now`,
            priority: 7,
          },
        };
      }

      // If in quiet hours, defer to peak hours
      if (inQuietHours) {
        const peakHour = engagementProfile.peakAttentionHours[0]?.split('-')[0] || '14:00';
        const [peakHourNum, peakMinNum] = peakHour.split(':').map(Number);

        const deferUntil = new Date(timestamp);
        deferUntil.setHours(peakHourNum, peakMinNum, 0, 0);

        // If peak hour has passed today, defer to tomorrow
        if (deferUntil <= timestamp) {
          deferUntil.setDate(deferUntil.getDate() + 1);
        }

        return {
          routingDecision: {
            action: 'DEFER',
            deferUntil,
            channel: engagementProfile.preferredChannels.routine,
            reasoning: `User is in quiet hours (${currentTimeStr}). Deferring to peak attention time (${peakHour}).`,
            priority: 3,
          },
        };
      }

      // Check notification saturation
      if (engagementProfile.notificationSaturation.status === 'OVERLOADED') {
        // Batch into digest instead of sending individually
        const digestTime = preferences?.digestTime || '14:00';
        const [digestHour, digestMin] = digestTime.split(':').map(Number);

        const digestAt = new Date(timestamp);
        digestAt.setHours(digestHour, digestMin, 0, 0);
        if (digestAt <= timestamp) {
          digestAt.setDate(digestAt.getDate() + 1);
        }

        return {
          routingDecision: {
            action: 'BATCH_DIGEST',
            deferUntil: digestAt,
            channel: 'email', // Digests always via email
            reasoning: `User is notification-overloaded (${engagementProfile.notificationSaturation.dailyCount}/day). Batching into daily digest.`,
            priority: 2,
          },
        };
      }

      // Default: Send now via routine channel
      return {
        routingDecision: {
          action: 'SEND_NOW',
          channel: engagementProfile.preferredChannels.routine,
          reasoning: 'Outside quiet hours, saturation normal: Sending now',
          priority: 5,
        },
      };
    } catch (error) {
      logger.error('[NotificationTiming] Routing failed, defaulting to send now', { error, userId });
      return {
        routingDecision: {
          action: 'SEND_NOW',
          channel: 'in_app',
          reasoning: 'Routing failed: Defaulting to immediate in-app notification',
          priority: 5,
        },
      };
    }
  }

  /**
   * Create and schedule a notification
   */
  async createNotification(params: NotificationRequest): Promise<{
    notification: { id: string; status: string; scheduledFor: Date | null };
    routingDecision: RoutingDecision;
  }> {
    const { userId, organizationId, type, title, message, urgency, metadata } = params;

    // Get routing decision
    const { routingDecision } = await this.routeNotification({
      userId,
      notification: params,
    });

    // Create notification record
    const notification = await prisma.notifications.create({
      data: {
        id: randomUUID(),
        userId,
        organizationId,
        type,
        title,
        message,
        urgency,
        channel: routingDecision.channel,
        status: routingDecision.action === 'SEND_NOW' ? 'sent' : 'pending',
        scheduledFor: routingDecision.deferUntil || null,
        deferredFrom: routingDecision.action === 'DEFER' ? new Date() : null,
        deferReason: routingDecision.action !== 'SEND_NOW' ? routingDecision.reasoning : null,
        sentAt: routingDecision.action === 'SEND_NOW' ? new Date() : null,
        metadata: metadata || {},
        updatedAt: new Date(),
      },
    });

    // If sending now, create engagement log entry
    if (routingDecision.action === 'SEND_NOW') {
      await prisma.notification_engagement_logs.create({
        data: {
          id: randomUUID(),
          userId,
          notificationId: notification.id,
          sentAt: new Date(),
          hourOfDay: new Date().getHours(),
          dayOfWeek: new Date().getDay(),
          channel: routingDecision.channel,
          notificationType: type,
          urgency,
        },
      });
    }

    logger.info('[NotificationTiming] Notification created', {
      notificationId: notification.id,
      action: routingDecision.action,
      channel: routingDecision.channel,
    });

    return {
      notification: {
        id: notification.id,
        status: notification.status,
        scheduledFor: notification.scheduledFor,
      },
      routingDecision,
    };
  }

  /**
   * Record user engagement with a notification
   */
  async recordEngagement(params: {
    notificationId: string;
    engagementType: 'clicked' | 'read' | 'dismissed' | 'ignored';
  }): Promise<{ success: boolean }> {
    const { notificationId, engagementType } = params;

    const notification = await prisma.notifications.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return { success: false };
    }

    const now = new Date();
    const responseTimeMs = notification.sentAt
      ? now.getTime() - notification.sentAt.getTime()
      : null;

    // Update notification
    await prisma.notifications.update({
      where: { id: notificationId },
      data: {
        status: engagementType === 'dismissed' ? 'dismissed' : 'read',
        readAt: engagementType === 'read' || engagementType === 'clicked' ? now : null,
        dismissedAt: engagementType === 'dismissed' ? now : null,
        engagementTimeMs: responseTimeMs,
        engagementAction: engagementType,
      },
    });

    // Update engagement log
    await prisma.notification_engagement_logs.updateMany({
      where: { notificationId },
      data: {
        engagedAt: now,
        engagementType,
        responseTimeMs,
      },
    });

    // Clear cache to reflect new engagement data
    this.profileCache.delete(notification.userId);

    logger.info('[NotificationTiming] Engagement recorded', {
      notificationId,
      engagementType,
      responseTimeMs,
    });

    return { success: true };
  }

  /**
   * Get pending notifications for digest
   */
  async getPendingDigest(params: { userId: string }): Promise<NotificationDigest | null> {
    const { userId } = params;

    const pendingNotifications = await prisma.notifications.findMany({
      where: {
        userId,
        status: 'pending',
        scheduledFor: { lte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (pendingNotifications.length === 0) {
      return null;
    }

    return {
      userId,
      notifications: pendingNotifications.map((n: any) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        scheduledFor: n.scheduledFor || new Date(),
      })),
      scheduledFor: new Date(),
      channel: 'email',
    };
  }

  /**
   * Get user notification preferences
   */
  async getPreferences(params: { userId: string }): Promise<{
    preferences: {
      quietModeEnabled: boolean;
      quietHours: { start: string; end: string };
      peakHours: { start: string; end: string };
      urgentChannel: string;
      routineChannel: string;
      digestEnabled: boolean;
      digestFrequency: string;
      digestTime: string;
      aiLearningEnabled: boolean;
      aiConfidence: number;
    };
  }> {
    let prefs = await prisma.notification_preferences.findUnique({
      where: { userId: params.userId },
    });

    if (!prefs) {
      prefs = await prisma.notification_preferences.create({
        data: {
          id: randomUUID(),
          userId: params.userId,
          updatedAt: new Date(),
        },
      });
    }

    return {
      preferences: {
        quietModeEnabled: prefs.quietModeEnabled,
        quietHours: {
          start: prefs.quietHoursStart,
          end: prefs.quietHoursEnd,
        },
        peakHours: {
          start: prefs.peakHoursStart,
          end: prefs.peakHoursEnd,
        },
        urgentChannel: prefs.urgentChannel,
        routineChannel: prefs.routineChannel,
        digestEnabled: prefs.enableDigest,
        digestFrequency: prefs.digestFrequency,
        digestTime: prefs.digestTime,
        aiLearningEnabled: prefs.aiLearningEnabled,
        aiConfidence: prefs.aiConfidence,
      },
    };
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(params: {
    userId: string;
    preferences: Partial<{
      quietModeEnabled: boolean;
      quietHoursStart: string;
      quietHoursEnd: string;
      peakHoursStart: string;
      peakHoursEnd: string;
      urgentChannel: string;
      routineChannel: string;
      enableDigest: boolean;
      digestFrequency: string;
      digestTime: string;
      aiLearningEnabled: boolean;
    }>;
  }): Promise<{ success: boolean }> {
    const { userId, preferences } = params;

    await prisma.notification_preferences.upsert({
      where: { userId },
      update: { ...preferences, updatedAt: new Date() },
      create: {
        id: randomUUID(),
        userId,
        ...preferences,
        updatedAt: new Date(),
      },
    });

    // Clear cache
    this.profileCache.delete(userId);

    return { success: true };
  }

  /**
   * Temporarily override quiet mode
   */
  async overrideQuietMode(params: {
    userId: string;
    durationMinutes: number;
    reason?: string;
  }): Promise<{ success: boolean; overrideUntil: Date }> {
    const { userId, durationMinutes, reason } = params;

    const overrideUntil = new Date();
    overrideUntil.setMinutes(overrideUntil.getMinutes() + durationMinutes);

    await prisma.notification_preferences.upsert({
      where: { userId },
      update: {
        overrideUntil,
        overrideReason: reason || 'Manual override',
        updatedAt: new Date(),
      },
      create: {
        id: randomUUID(),
        userId,
        overrideUntil,
        overrideReason: reason || 'Manual override',
        updatedAt: new Date(),
      },
    });

    logger.info('[NotificationTiming] Quiet mode overridden', {
      userId,
      durationMinutes,
      overrideUntil,
    });

    return { success: true, overrideUntil };
  }

  // ============================================================================
  // Analysis Helper Methods
  // ============================================================================

  private analyzeHourlyEngagement(logs: any[]): HourlyEngagement[] {
    const hourlyStats: Map<number, { sent: number; engaged: number; totalResponseTime: number }> = new Map();

    // Initialize all hours
    for (let h = 0; h < 24; h++) {
      hourlyStats.set(h, { sent: 0, engaged: 0, totalResponseTime: 0 });
    }

    // Aggregate stats
    for (const log of logs) {
      const hour = log.hourOfDay;
      const stats = hourlyStats.get(hour)!;
      stats.sent++;
      if (log.engagementType && log.engagementType !== 'ignored') {
        stats.engaged++;
        if (log.responseTimeMs) {
          stats.totalResponseTime += log.responseTimeMs;
        }
      }
    }

    return Array.from(hourlyStats.entries()).map(([hour, stats]) => ({
      hour,
      totalSent: stats.sent,
      engaged: stats.engaged,
      avgResponseTimeMs: stats.engaged > 0 ? stats.totalResponseTime / stats.engaged : 0,
      engagementRate: stats.sent > 0 ? stats.engaged / stats.sent : 0,
    }));
  }

  private findPeakHours(hourlyEngagement: HourlyEngagement[]): string[] {
    // Find hours with engagement rate > 60% and response time < 30 min
    const peakHours = hourlyEngagement
      .filter(h => h.engagementRate > 0.6 && h.avgResponseTimeMs < 30 * 60 * 1000 && h.totalSent >= 5)
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 3)
      .map(h => h.hour);

    if (peakHours.length === 0) {
      return ['14:00-16:00']; // Default
    }

    // Group consecutive hours into ranges
    const ranges = this.groupConsecutiveHours(peakHours);
    return ranges.map(r => `${r.start.toString().padStart(2, '0')}:00-${(r.end + 1).toString().padStart(2, '0')}:00`);
  }

  private findQuietHours(hourlyEngagement: HourlyEngagement[]): string[] {
    // Find hours with engagement rate < 30% or response time > 2 hours
    const quietHours = hourlyEngagement
      .filter(h => (h.engagementRate < 0.3 || h.avgResponseTimeMs > 2 * 60 * 60 * 1000) && h.totalSent >= 3)
      .map(h => h.hour);

    if (quietHours.length === 0) {
      return ['09:00-12:00']; // Default
    }

    // Group consecutive hours into ranges
    const ranges = this.groupConsecutiveHours(quietHours);
    return ranges.map(r => `${r.start.toString().padStart(2, '0')}:00-${(r.end + 1).toString().padStart(2, '0')}:00`);
  }

  private groupConsecutiveHours(hours: number[]): Array<{ start: number; end: number }> {
    if (hours.length === 0) return [];

    const sorted = [...hours].sort((a, b) => a - b);
    const ranges: Array<{ start: number; end: number }> = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push({ start, end });
        start = sorted[i];
        end = sorted[i];
      }
    }
    ranges.push({ start, end });

    return ranges;
  }

  private analyzeChannelPreferences(logs: any[]): { urgent: 'slack' | 'email' | 'in_app'; routine: 'slack' | 'email' | 'in_app' } {
    const channelStats: Record<string, Record<string, { sent: number; engaged: number }>> = {
      urgent: { in_app: { sent: 0, engaged: 0 }, email: { sent: 0, engaged: 0 }, slack: { sent: 0, engaged: 0 } },
      routine: { in_app: { sent: 0, engaged: 0 }, email: { sent: 0, engaged: 0 }, slack: { sent: 0, engaged: 0 } },
    };

    for (const log of logs) {
      const urgency = log.urgency || 'routine';
      const channel = log.channel || 'in_app';

      if (channelStats[urgency] && channelStats[urgency][channel]) {
        channelStats[urgency][channel].sent++;
        if (log.engagementType && log.engagementType !== 'ignored') {
          channelStats[urgency][channel].engaged++;
        }
      }
    }

    const getBestChannel = (urgency: string): 'slack' | 'email' | 'in_app' => {
      let best: 'slack' | 'email' | 'in_app' = 'in_app';
      let bestRate = 0;

      for (const [channel, stats] of Object.entries(channelStats[urgency])) {
        const rate = stats.sent > 0 ? stats.engaged / stats.sent : 0;
        if (rate > bestRate) {
          bestRate = rate;
          best = channel as 'slack' | 'email' | 'in_app';
        }
      }

      return best;
    };

    return {
      urgent: getBestChannel('urgent'),
      routine: getBestChannel('routine'),
    };
  }

  private detectSaturation(logs: any[]): {
    status: 'HEALTHY' | 'MODERATE' | 'OVERLOADED';
    dailyCount: number;
    recommendation: string;
  } {
    // Count notifications per day for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentLogs = logs.filter(l => new Date(l.sentAt) >= thirtyDaysAgo);
    const dailyCounts: Map<string, number> = new Map();

    for (const log of recentLogs) {
      const dateKey = new Date(log.sentAt).toISOString().split('T')[0];
      dailyCounts.set(dateKey, (dailyCounts.get(dateKey) || 0) + 1);
    }

    const avgDaily = dailyCounts.size > 0
      ? Array.from(dailyCounts.values()).reduce((a, b) => a + b, 0) / dailyCounts.size
      : 0;

    if (avgDaily > 25) {
      return {
        status: 'OVERLOADED',
        dailyCount: Math.round(avgDaily),
        recommendation: `Reduce routine notifications by ${Math.round((avgDaily - 15) / avgDaily * 100)}% or batch into digests`,
      };
    } else if (avgDaily > 15) {
      return {
        status: 'MODERATE',
        dailyCount: Math.round(avgDaily),
        recommendation: 'Consider batching low-priority notifications into daily digest',
      };
    }

    return {
      status: 'HEALTHY',
      dailyCount: Math.round(avgDaily),
      recommendation: 'Notification frequency is healthy',
    };
  }

  private calculateConfidence(dataPoints: number, hourlyEngagement: HourlyEngagement[]): number {
    // Confidence based on data quantity and distribution
    let confidence = 0;

    // Data quantity (0-0.4)
    if (dataPoints >= 500) confidence += 0.4;
    else if (dataPoints >= 200) confidence += 0.3;
    else if (dataPoints >= 100) confidence += 0.2;
    else if (dataPoints >= 50) confidence += 0.1;

    // Data distribution across hours (0-0.3)
    const hoursWithData = hourlyEngagement.filter(h => h.totalSent >= 3).length;
    confidence += (hoursWithData / 24) * 0.3;

    // Engagement rate consistency (0-0.3)
    const engagementRates = hourlyEngagement
      .filter(h => h.totalSent >= 3)
      .map(h => h.engagementRate);

    if (engagementRates.length >= 10) {
      const variance = this.calculateVariance(engagementRates);
      if (variance < 0.1) confidence += 0.3;
      else if (variance < 0.2) confidence += 0.2;
      else if (variance < 0.3) confidence += 0.1;
    }

    return Math.min(confidence, 1);
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  private isInTimeRange(timeStr: string, ranges: string[]): boolean {
    const [hour, minute] = timeStr.split(':').map(Number);
    const timeMinutes = hour * 60 + minute;

    for (const range of ranges) {
      const [startStr, endStr] = range.split('-');
      const [startHour, startMin] = startStr.split(':').map(Number);
      const [endHour, endMin] = endStr.split(':').map(Number);

      const startMinutes = startHour * 60 + (startMin || 0);
      const endMinutes = endHour * 60 + (endMin || 0);

      if (timeMinutes >= startMinutes && timeMinutes < endMinutes) {
        return true;
      }
    }

    return false;
  }

  private getDefaultProfile(userId: string, preferences?: any): EngagementProfile {
    return {
      userId,
      peakAttentionHours: [preferences?.peakHoursStart && preferences?.peakHoursEnd
        ? `${preferences.peakHoursStart}-${preferences.peakHoursEnd}`
        : '14:00-16:00'],
      quietHours: [preferences?.quietHoursStart && preferences?.quietHoursEnd
        ? `${preferences.quietHoursStart}-${preferences.quietHoursEnd}`
        : '09:00-12:00'],
      preferredChannels: {
        urgent: (preferences?.urgentChannel as 'slack' | 'email' | 'in_app') || 'in_app',
        routine: (preferences?.routineChannel as 'slack' | 'email' | 'in_app') || 'in_app',
      },
      notificationSaturation: {
        status: 'HEALTHY',
        dailyCount: 0,
        recommendation: 'Not enough data to analyze saturation',
      },
      confidence: 0,
      dataPoints: 0,
      lastAnalyzedAt: new Date(),
    };
  }
}

// Export singleton instance
export const notificationTimingService = new NotificationTimingService();
