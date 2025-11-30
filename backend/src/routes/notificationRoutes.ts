// backend/src/routes/notificationRoutes.ts
/**
 * Notification Routes
 *
 * Phase 7, Task 7.5 of ADR-005 Multi-Tenant Access Control
 * AI Use Case 20: Behavioral Quiet Mode
 *
 * Endpoints for notification timing, preferences, and engagement tracking.
 */

import express from 'express';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  getEngagementProfile,
  overrideQuietMode,
  previewNotificationRoute,
  createNotification,
  recordNotificationEngagement,
  getNotificationDigest,
} from '../controllers/notificationTimingController';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticateJWT);

// ============================================================================
// Preferences Routes
// ============================================================================

/**
 * GET /api/notifications/preferences
 * Get current user's notification preferences
 *
 * Response:
 * - preferences: { quietModeEnabled, quietHours, peakHours, channels, digest settings }
 */
router.get('/preferences', getNotificationPreferences);

/**
 * PUT /api/notifications/preferences
 * Update current user's notification preferences
 *
 * Request Body:
 * - quietModeEnabled: boolean
 * - quietHoursStart: string (HH:mm)
 * - quietHoursEnd: string (HH:mm)
 * - peakHoursStart: string (HH:mm)
 * - peakHoursEnd: string (HH:mm)
 * - urgentChannel: 'in_app' | 'email' | 'slack'
 * - routineChannel: 'in_app' | 'email' | 'slack'
 * - enableDigest: boolean
 * - digestFrequency: 'daily' | 'twice_daily' | 'weekly'
 * - digestTime: string (HH:mm)
 * - aiLearningEnabled: boolean
 */
router.put('/preferences', updateNotificationPreferences);

// ============================================================================
// AI Learning Routes
// ============================================================================

/**
 * GET /api/notifications/engagement-profile
 * Get AI-learned engagement profile for current user
 *
 * Query Parameters:
 * - refresh: 'true' to force re-analysis (bypasses cache)
 *
 * Response:
 * - engagementProfile: { peakAttentionHours, quietHours, preferredChannels, saturation, confidence }
 */
router.get('/engagement-profile', getEngagementProfile);

/**
 * POST /api/notifications/override-quiet-mode
 * Temporarily override quiet mode (e.g., during critical project phase)
 *
 * Request Body:
 * - durationMinutes: number (1-1440)
 * - reason?: string
 *
 * Response:
 * - overrideUntil: Date
 */
router.post('/override-quiet-mode', overrideQuietMode);

// ============================================================================
// Notification Management Routes
// ============================================================================

/**
 * POST /api/notifications/route
 * Preview routing decision for a notification (without creating it)
 *
 * Request Body:
 * - type: string
 * - title: string
 * - message: string
 * - urgency: 'urgent' | 'routine'
 *
 * Response:
 * - routingDecision: { action, deferUntil?, channel, reasoning, priority }
 */
router.post('/route', previewNotificationRoute);

/**
 * POST /api/notifications
 * Create and route a notification
 *
 * Request Body:
 * - targetUserId?: string (defaults to current user, requires ManageUsers for others)
 * - organizationId?: string
 * - type: string
 * - title: string
 * - message: string
 * - urgency?: 'urgent' | 'routine'
 * - metadata?: object
 *
 * Response:
 * - notification: { id, status, scheduledFor }
 * - routingDecision: { action, deferUntil?, channel, reasoning }
 */
router.post('/', createNotification);

/**
 * POST /api/notifications/:id/engage
 * Record user engagement with a notification
 *
 * Request Body:
 * - engagementType: 'clicked' | 'read' | 'dismissed' | 'ignored'
 *
 * Response:
 * - success: boolean
 */
router.post('/:id/engage', recordNotificationEngagement);

/**
 * GET /api/notifications/digest
 * Get pending notification digest for current user
 *
 * Response:
 * - digest: { notifications, scheduledFor, channel } | null
 * - hasDigest: boolean
 * - notificationCount: number
 */
router.get('/digest', getNotificationDigest);

export default router;
