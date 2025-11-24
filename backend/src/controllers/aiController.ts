import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import aiService from '../services/ai/AiService';
import { logger } from '../utils/logger';

export class AiController {
  /**
   * POST /api/ai/chat
   * Send chat request to AI provider
   */
  async chat(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { messages, model, temperature, maxTokens, organizationId } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Messages array required' });
        return;
      }

      if (!organizationId) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Organization ID required' });
        return;
      }

      // Verify user has access to this organization
      if (req.user.role !== 'admin' && !req.user.organizationIds.includes(organizationId)) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'No access to this organization' });
        return;
      }

      const response = await aiService.chat({
        messages,
        model,
        temperature,
        maxTokens,
        userId: req.user.userId,
        organizationId,
      });

      res.json(response);
    } catch (error: any) {
      logger.error('AI chat controller error:', error);

      if (error.message.includes('budget')) {
        res.status(429).json({ error: 'BUDGET_EXCEEDED', message: error.message });
      } else if (error.message.includes('not enabled') || error.message.includes('disabled')) {
        res.status(403).json({ error: 'AI_DISABLED', message: error.message });
      } else if (error.message.includes('AUTHENTICATION_FAILED')) {
        res.status(500).json({ error: 'PROVIDER_AUTH_FAILED', message: 'AI provider authentication failed' });
      } else if (error.message.includes('QUOTA_EXCEEDED')) {
        res.status(429).json({ error: 'PROVIDER_QUOTA_EXCEEDED', message: 'AI provider quota exceeded' });
      } else {
        res.status(500).json({ error: 'AI_REQUEST_FAILED', message: 'AI request failed' });
      }
    }
  }

  /**
   * GET /api/ai/usage
   * Get AI usage statistics
   */
  async getUsage(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { organizationId, timeRange } = req.query;

      if (!organizationId) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Organization ID required' });
        return;
      }

      // Verify user has access to this organization
      if (req.user.role !== 'admin' && !req.user.organizationIds.includes(organizationId as string)) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'No access to this organization' });
        return;
      }

      const stats = await aiService.getUsageStats(
        organizationId as string,
        (timeRange as 'day' | 'week' | 'month') || 'month'
      );

      res.json(stats);
    } catch (error) {
      logger.error('AI usage controller error:', error);
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get usage stats' });
    }
  }
}

export default new AiController();
