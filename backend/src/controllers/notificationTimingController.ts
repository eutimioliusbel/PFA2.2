// backend/src/controllers/notificationTimingController.ts
/**
 * Notification Timing Controller
 *
 * Phase 7, Task 7.5 of ADR-005 Multi-Tenant Access Control
 * AI Use Case 20: Behavioral Quiet Mode
 *
 * API endpoints for notification timing and preferences.
 */

import { Request, Response } from 'express';
import { notificationTimingService } from '../services/ai/NotificationTimingService';
import { logger } from '../utils/logger';
import { handleControllerError } from '../utils/errorHandling';

// ============================================================================
// Types
// ============================================================================

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
    organizations: Array<{
      organizationId: string;
      organizationCode: string;
      role: string;
      permissions: Record<string, boolean>;
    }>;
  };
}

// ============================================================================
// Controllers
// ============================================================================

/**
 * GET /api/notifications/preferences
 *
 * Get current user's notification preferences
 */
export async function getNotificationPreferences(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const result = await notificationTimingService.getPreferences({
      userId: user.userId,
    });

    return res.status(200).json({
      success: true,
      preferences: result.preferences,
    });
  } catch (error: unknown) {
    return handleControllerError(error, res, 'NotificationTimingController.getNotificationPreferences');
  }
}

/**
 * PUT /api/notifications/preferences
 *
 * Update current user's notification preferences
 */
export async function updateNotificationPreferences(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const {
      quietModeEnabled,
      quietHoursStart,
      quietHoursEnd,
      peakHoursStart,
      peakHoursEnd,
      urgentChannel,
      routineChannel,
      enableDigest,
      digestFrequency,
      digestTime,
      aiLearningEnabled,
    } = req.body;

    // Validate time format (HH:mm)
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    const timeFields = { quietHoursStart, quietHoursEnd, peakHoursStart, peakHoursEnd, digestTime };

    for (const [field, value] of Object.entries(timeFields)) {
      if (value !== undefined && !timeRegex.test(value)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: `Invalid time format for ${field}. Use HH:mm format.`,
        });
      }
    }

    // Validate channel values
    const validChannels = ['in_app', 'email', 'slack'];
    if (urgentChannel && !validChannels.includes(urgentChannel)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid urgentChannel. Use in_app, email, or slack.',
      });
    }
    if (routineChannel && !validChannels.includes(routineChannel)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid routineChannel. Use in_app, email, or slack.',
      });
    }

    // Validate digest frequency
    const validFrequencies = ['daily', 'twice_daily', 'weekly'];
    if (digestFrequency && !validFrequencies.includes(digestFrequency)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid digestFrequency. Use daily, twice_daily, or weekly.',
      });
    }

    await notificationTimingService.updatePreferences({
      userId: user.userId,
      preferences: {
        quietModeEnabled,
        quietHoursStart,
        quietHoursEnd,
        peakHoursStart,
        peakHoursEnd,
        urgentChannel,
        routineChannel,
        enableDigest,
        digestFrequency,
        digestTime,
        aiLearningEnabled,
      },
    });

    logger.info('Notification preferences updated', {
      userId: user.userId,
    });

    return res.status(200).json({
      success: true,
      message: 'Preferences updated successfully',
    });
  } catch (error: unknown) {
    return handleControllerError(error, res, 'NotificationTimingController.updateNotificationPreferences');
  }
}

/**
 * GET /api/notifications/engagement-profile
 *
 * Get AI-learned engagement profile for current user
 */
export async function getEngagementProfile(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const forceRefresh = req.query.refresh === 'true';

    const result = await notificationTimingService.learnNotificationPreferences({
      userId: user.userId,
      forceRefresh,
    });

    return res.status(200).json({
      success: true,
      engagementProfile: result.engagementProfile,
    });
  } catch (error: unknown) {
    return handleControllerError(error, res, 'NotificationTimingController.getEngagementProfile');
  }
}

/**
 * POST /api/notifications/override-quiet-mode
 *
 * Temporarily override quiet mode (e.g., during important project phase)
 */
export async function overrideQuietMode(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const { durationMinutes, reason } = req.body;

    if (!durationMinutes || typeof durationMinutes !== 'number' || durationMinutes < 1) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'durationMinutes is required and must be a positive number',
      });
    }

    if (durationMinutes > 24 * 60) { // Max 24 hours
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'durationMinutes cannot exceed 1440 (24 hours)',
      });
    }

    const result = await notificationTimingService.overrideQuietMode({
      userId: user.userId,
      durationMinutes,
      reason,
    });

    logger.info('Quiet mode overridden', {
      userId: user.userId,
      durationMinutes,
      overrideUntil: result.overrideUntil,
    });

    return res.status(200).json({
      success: true,
      overrideUntil: result.overrideUntil,
      message: `Quiet mode overridden for ${durationMinutes} minutes`,
    });
  } catch (error: unknown) {
    return handleControllerError(error, res, 'NotificationTimingController.overrideQuietMode');
  }
}

/**
 * POST /api/notifications/route
 *
 * Get routing decision for a notification (for testing/preview)
 */
export async function previewNotificationRoute(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const { type, title, message, urgency } = req.body;

    if (!type || !title || !message) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'type, title, and message are required',
      });
    }

    const validUrgencies = ['urgent', 'routine'];
    if (urgency && !validUrgencies.includes(urgency)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid urgency. Use urgent or routine.',
      });
    }

    const result = await notificationTimingService.routeNotification({
      userId: user.userId,
      notification: {
        userId: user.userId,
        type,
        title,
        message,
        urgency: urgency || 'routine',
      },
    });

    return res.status(200).json({
      success: true,
      routingDecision: result.routingDecision,
    });
  } catch (error: unknown) {
    return handleControllerError(error, res, 'NotificationTimingController.previewNotificationRoute');
  }
}

/**
 * POST /api/notifications
 *
 * Create and route a notification
 */
export async function createNotification(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const { targetUserId, organizationId, type, title, message, urgency, metadata } = req.body;

    // Users can only send to themselves unless they have ManageUsers permission
    const canSendToOthers = user.organizations.some(
      org => org.permissions?.perm_ManageUsers
    );

    if (targetUserId && targetUserId !== user.userId && !canSendToOthers) {
      return res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'ManageUsers permission required to send notifications to other users',
      });
    }

    const finalUserId = targetUserId || user.userId;

    if (!type || !title || !message) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'type, title, and message are required',
      });
    }

    const result = await notificationTimingService.createNotification({
      userId: finalUserId,
      organizationId,
      type,
      title,
      message,
      urgency: urgency || 'routine',
      metadata,
    });

    logger.info('Notification created', {
      notificationId: result.notification.id,
      userId: finalUserId,
      type,
      action: result.routingDecision.action,
    });

    return res.status(201).json({
      success: true,
      notification: result.notification,
      routingDecision: result.routingDecision,
    });
  } catch (error: unknown) {
    return handleControllerError(error, res, 'NotificationTimingController.createNotification');
  }
}

/**
 * POST /api/notifications/:id/engage
 *
 * Record user engagement with a notification
 */
export async function recordNotificationEngagement(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const { id } = req.params;
    const { engagementType } = req.body;

    if (!id) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Notification ID is required',
      });
    }

    const validEngagementTypes = ['clicked', 'read', 'dismissed', 'ignored'];
    if (!engagementType || !validEngagementTypes.includes(engagementType)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid engagementType. Use clicked, read, dismissed, or ignored.',
      });
    }

    const result = await notificationTimingService.recordEngagement({
      notificationId: id,
      engagementType,
    });

    if (!result.success) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Notification not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Engagement recorded',
    });
  } catch (error: unknown) {
    return handleControllerError(error, res, 'NotificationTimingController.recordNotificationEngagement');
  }
}

/**
 * GET /api/notifications/digest
 *
 * Get pending notification digest for current user
 */
export async function getNotificationDigest(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const digest = await notificationTimingService.getPendingDigest({
      userId: user.userId,
    });

    return res.status(200).json({
      success: true,
      digest,
      hasDigest: digest !== null,
      notificationCount: digest?.notifications.length || 0,
    });
  } catch (error: unknown) {
    return handleControllerError(error, res, 'NotificationTimingController.getNotificationDigest');
  }
}
