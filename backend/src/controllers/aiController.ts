import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import aiService from '../services/ai/AiService';
import permissionSuggestionService from '../services/ai/PermissionSuggestionService';
import { logger } from '../utils/logger';
import { handleControllerError } from '../utils/errorHandling';

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
      const hasAccess = req.user.organizations.some(org => org.organizationId === organizationId);
      if (!hasAccess) {
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
    } catch (error: unknown) {
      handleControllerError(error, res, 'AiController.chat');
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
      const hasAccess = req.user.organizations.some(org => org.organizationId === organizationId);
      if (!hasAccess) {
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

  /**
   * POST /api/ai/suggest-permissions
   * Get AI-powered permission suggestions for a user-organization assignment
   *
   * Requires: User must have perm_ManageUsers for the target organization
   */
  async suggestPermissions(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { targetUserId, organizationId, role, department } = req.body;

      // Validate required fields
      if (!targetUserId || !organizationId) {
        res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'targetUserId and organizationId are required',
        });
        return;
      }

      // Verify requesting user has perm_ManageUsers for this organization
      // This check will be implemented via middleware in production
      // For now, check if user has access to organization
      const hasAccess = req.user.organizations.some(org => org.organizationId === organizationId);
      if (!hasAccess) {
        res.status(403).json({
          error: 'FORBIDDEN',
          message: 'No access to this organization',
        });
        return;
      }

      // Get AI permission suggestion
      const suggestion = await permissionSuggestionService.suggestPermissions({
        userId: targetUserId,
        organizationId,
        role,
        department,
      });

      res.json(suggestion);
    } catch (error: unknown) {
      handleControllerError(error, res, 'AiController.suggestPermissions');
    }
  }

  /**
   * POST /api/ai/accept-suggestion
   * Record acceptance or modification of an AI permission suggestion
   *
   * Used to train the AI model and track suggestion accuracy
   */
  async acceptSuggestion(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { suggestionId, accepted, finalPermissions } = req.body;

      if (!suggestionId || typeof accepted !== 'boolean') {
        res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'suggestionId and accepted (boolean) are required',
        });
        return;
      }

      await permissionSuggestionService.recordSuggestionOutcome(
        suggestionId,
        accepted,
        finalPermissions
      );

      res.json({
        success: true,
        message: 'Suggestion outcome recorded',
      });
    } catch (error) {
      logger.error('Accept suggestion controller error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to record suggestion outcome',
      });
    }
  }

  /**
   * GET /api/ai/suggestion-stats
   * Get statistics about AI permission suggestions
   *
   * Useful for monitoring AI accuracy and acceptance rates
   */
  async getSuggestionStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { organizationId } = req.query;

      // Admins can view stats for any organization
      // Regular users can only view stats for their organizations
      if (organizationId) {
        const hasAccess = req.user.organizations.some(org => org.organizationId === organizationId);
        if (!hasAccess) {
          res.status(403).json({
            error: 'FORBIDDEN',
            message: 'No access to this organization',
          });
          return;
        }
      }

      const stats = await permissionSuggestionService.getSuggestionStats(
        organizationId as string | undefined
      );

      res.json(stats);
    } catch (error) {
      logger.error('Suggestion stats controller error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to get suggestion statistics',
      });
    }
  }
}

export default new AiController();
