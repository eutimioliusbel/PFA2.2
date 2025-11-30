/**
 * Webhook Configuration Controller
 * ADR-005 Missing Components - Integrations Hub
 *
 * Handles webhook configurations for Slack, Teams, and custom webhooks.
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import axios from 'axios';
import { logger } from '../utils/logger';
import { handleControllerError } from '../utils/errorHandling';

/**
 * Get all webhook configurations
 * GET /api/webhooks
 *
 * Filters webhooks by user's authorized organizations for security
 */
export const getAllWebhooks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.query;

    // Get user's allowed organizations from JWT token
    const userOrganizations = req.user?.organizations?.map(o => o.organizationId) || [];

    const where: any = {};

    // Filter by organization if specified (and user has access)
    if (organizationId) {
      if (userOrganizations.includes(organizationId as string)) {
        where.organizationId = organizationId;
      } else {
        res.status(403).json({
          error: 'ACCESS_DENIED',
          message: 'You do not have access to this organization'
        });
        return;
      }
    } else {
      // Return global webhooks and org-specific for user's orgs only
      where.OR = [
        { organizationId: null }, // Global webhooks
        { organizationId: { in: userOrganizations } } // User's organizations
      ];
    }

    const webhooks = await prisma.webhook_configs.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json(webhooks);
  } catch (error: unknown) {
    handleControllerError(error, res, 'WebhookController.getAllWebhooks');
  }
};

/**
 * Get a single webhook by ID
 * GET /api/webhooks/:id
 */
export const getWebhookById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const webhook = await prisma.webhook_configs.findUnique({
      where: { id },
    });

    if (!webhook) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    res.json(webhook);
  } catch (error: unknown) {
    handleControllerError(error, res, 'WebhookController.getWebhookById');
  }
};

/**
 * Create a new webhook configuration
 * POST /api/webhooks
 */
export const createWebhook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      organizationId,
      type,
      name,
      webhookUrl,
      channelName,
      eventTriggers,
    } = req.body as {
      organizationId?: string;
      type: string;
      name: string;
      webhookUrl: string;
      channelName?: string;
      eventTriggers: string[];
    };

    if (!type || !name || !webhookUrl || !eventTriggers) {
      res.status(400).json({
        error: 'Type, name, webhookUrl, and eventTriggers are required',
      });
      return;
    }

    // Validate webhook type
    if (!['slack', 'teams', 'custom'].includes(type)) {
      res.status(400).json({ error: 'Invalid webhook type' });
      return;
    }

    const userId = req.user?.userId || 'system';

    const webhook = await prisma.webhook_configs.create({
      data: {
        id: `webhook_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        organizationId: organizationId || null,
        type,
        name,
        webhookUrl,
        channelName: channelName || null,
        eventTriggers: eventTriggers as any,
        createdBy: userId,
        updatedAt: new Date(),
      },
    });

    logger.info(`Webhook created: ${name} (${type}) by ${userId}`);
    res.status(201).json(webhook);
  } catch (error: unknown) {
    handleControllerError(error, res, 'WebhookController.createWebhook');
  }
};

/**
 * Update a webhook configuration
 * PUT /api/webhooks/:id
 */
export const updateWebhook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      webhookUrl,
      channelName,
      isActive,
      eventTriggers,
    } = req.body as {
      name?: string;
      webhookUrl?: string;
      channelName?: string;
      isActive?: boolean;
      eventTriggers?: string[];
    };

    const existing = await prisma.webhook_configs.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    const updated = await prisma.webhook_configs.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        webhookUrl: webhookUrl ?? existing.webhookUrl,
        channelName: channelName ?? existing.channelName,
        isActive: isActive ?? existing.isActive,
        eventTriggers: (eventTriggers as any) ?? existing.eventTriggers,
        updatedAt: new Date(),
      },
    });

    logger.info(`Webhook updated: ${updated.name}`);
    res.json(updated);
  } catch (error: unknown) {
    handleControllerError(error, res, 'WebhookController.updateWebhook');
  }
};

/**
 * Delete a webhook configuration
 * DELETE /api/webhooks/:id
 */
export const deleteWebhook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const webhook = await prisma.webhook_configs.findUnique({
      where: { id },
    });

    if (!webhook) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    await prisma.webhook_configs.delete({
      where: { id },
    });

    logger.info(`Webhook deleted: ${webhook.name}`);
    res.json({ message: 'Webhook deleted successfully' });
  } catch (error: unknown) {
    handleControllerError(error, res, 'WebhookController.deleteWebhook');
  }
};

/**
 * Test a webhook by sending a test payload
 * POST /api/webhooks/:id/test
 */
export const testWebhook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const webhook = await prisma.webhook_configs.findUnique({
      where: { id },
    });

    if (!webhook) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    // Build test payload based on webhook type
    let payload: any;
    switch (webhook.type) {
      case 'slack':
        payload = {
          text: '🧪 Test notification from PFA Vanguard',
          channel: webhook.channelName,
          username: 'PFA Vanguard',
          icon_emoji: ':robot_face:',
        };
        break;

      case 'teams':
        payload = {
          '@type': 'MessageCard',
          '@context': 'https://schema.org/extensions',
          summary: 'Test notification',
          themeColor: '0078D4',
          title: 'PFA Vanguard Test',
          text: '🧪 This is a test notification from PFA Vanguard.',
        };
        break;

      case 'custom':
        payload = {
          event: 'test',
          message: 'Test notification from PFA Vanguard',
          timestamp: new Date().toISOString(),
        };
        break;

      default:
        res.status(400).json({ error: 'Unsupported webhook type' });
        return;
    }

    // Send the test request
    const startTime = Date.now();
    try {
      const response = await axios.post(webhook.webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      const latency = Date.now() - startTime;

      // Update last test timestamp
      await prisma.webhook_configs.update({
        where: { id },
        data: {
          lastTestAt: new Date(),
          lastTestSuccess: true,
          lastTestError: null,
        },
      });

      logger.info(`Webhook test successful: ${webhook.name} (${latency}ms)`);
      res.json({
        success: true,
        statusCode: response.status,
        latency,
        message: 'Webhook test successful',
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'WebhookController.testWebhook');
    }
  } catch (error: unknown) {
    handleControllerError(error, res, 'WebhookController.testWebhook');
  }
};

/**
 * Trigger a webhook for a specific event
 * This is an internal function called by the notification system
 */
export async function triggerWebhook(
  eventType: string,
  payload: any,
  organizationId?: string
): Promise<void> {
  try {
    // Find all active webhooks that listen to this event
    const webhooks = await prisma.webhook_configs.findMany({
      where: {
        isActive: true,
        eventTriggers: {
          array_contains: eventType,
        },
        OR: [
          { organizationId: null }, // Global webhooks
          { organizationId }, // Org-specific webhooks
        ],
      },
    });

    // Send to each webhook in parallel
    const promises = webhooks.map(async (webhook: any) => {
      try {
        // Format payload based on webhook type
        let formattedPayload: any;
        switch (webhook.type) {
          case 'slack':
            formattedPayload = formatSlackPayload(eventType, payload, webhook);
            break;
          case 'teams':
            formattedPayload = formatTeamsPayload(eventType, payload, webhook);
            break;
          case 'custom':
            formattedPayload = { event: eventType, data: payload };
            break;
          default:
            return;
        }

        await axios.post(webhook.webhookUrl, formattedPayload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000,
        });

        // Update last triggered timestamp
        await prisma.webhook_configs.update({
          where: { id: webhook.id },
          data: { lastTriggeredAt: new Date() },
        });

        logger.info(`Webhook triggered: ${webhook.name} for event ${eventType}`);
      } catch (error) {
        logger.error(`Webhook trigger failed: ${webhook.name}`, error);
      }
    });

    await Promise.allSettled(promises);
  } catch (error) {
    logger.error('Error triggering webhooks:', error);
  }
}

/**
 * Format payload for Slack
 */
function formatSlackPayload(eventType: string, data: any, webhook: any): any {
  return {
    text: `🔔 *${eventType}*\n${JSON.stringify(data, null, 2)}`,
    channel: webhook.channelName,
    username: 'PFA Vanguard',
    icon_emoji: ':chart_with_upwards_trend:',
  };
}

/**
 * Format payload for Microsoft Teams
 */
function formatTeamsPayload(eventType: string, data: any, _webhook: any): any {
  return {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    summary: eventType,
    themeColor: '0078D4',
    title: `PFA Vanguard: ${eventType}`,
    text: JSON.stringify(data, null, 2),
  };
}
