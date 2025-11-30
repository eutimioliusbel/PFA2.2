/**
 * Unit Tests for PermissionSuggestionService
 *
 * Phase 6, Task 6.1 of ADR-005 Multi-Tenant Access Control
 *
 * Tests AI-powered permission suggestion logic including:
 * - Historical pattern analysis
 * - AI-powered suggestions
 * - Rule-based fallbacks
 * - Security risk detection
 * - Caching behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PermissionSuggestionService } from '../../../../src/services/ai/PermissionSuggestionService';

// Mock Prisma client
const mockPrisma = {
  userOrganization: {
    findMany: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock('../../../../src/config/database', () => ({
  default: mockPrisma,
}));

// Mock GeminiAdapter
vi.mock('../../../../src/services/ai/GeminiAdapter', () => ({
  GeminiAdapter: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockResolvedValue({
      text: JSON.stringify({
        suggestedRole: 'editor',
        suggestedCapabilities: {
          perm_Read: true,
          perm_EditForecast: true,
          perm_EditActuals: false,
          perm_Delete: false,
          perm_Import: false,
          perm_RefreshData: true,
          perm_Export: true,
          perm_ViewFinancials: false,
          perm_SaveDraft: true,
          perm_Sync: false,
          perm_ManageUsers: false,
          perm_ManageSettings: false,
          perm_ConfigureAlerts: false,
          perm_Impersonate: false,
        },
        confidence: 0.92,
        reasoning: 'Based on 150 similar Project Managers with editor-level access',
      }),
    }),
  })),
}));

describe('PermissionSuggestionService', () => {
  let service: PermissionSuggestionService;

  beforeEach(() => {
    service = new PermissionSuggestionService();
    vi.clearAllMocks();

    // Reset environment
    process.env.GEMINI_API_KEY = 'test-api-key';

    // Default mock audit log creation
    mockPrisma.auditLog.create.mockResolvedValue({
      id: 'suggestion-123',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('suggestPermissions', () => {
    it('should return AI suggestion when 100+ similar users found', async () => {
      // Mock 150 similar users
      const mockUsers = Array.from({ length: 150 }, (_, i) => ({
        id: `userOrg-${i}`,
        userId: `user-${i}`,
        organizationId: 'org-123',
        role: 'editor',
        perm_Read: true,
        perm_EditForecast: i < 120, // 80% have this
        perm_EditActuals: false,
        perm_Delete: false,
        perm_Import: false,
        perm_RefreshData: i < 90, // 60% have this
        perm_Export: true,
        perm_ViewFinancials: false,
        perm_SaveDraft: i < 105, // 70% have this
        perm_Sync: false,
        perm_ManageUsers: false,
        perm_ManageSettings: false,
        perm_ConfigureAlerts: false,
        perm_Impersonate: false,
        user: {
          id: `user-${i}`,
          username: `user${i}`,
          role: 'user',
        },
        organization: {
          id: 'org-123',
          code: 'HOLNG',
        },
      }));

      mockPrisma.userOrganization.findMany.mockResolvedValue(mockUsers);

      const result = await service.suggestPermissions({
        userId: 'new-user',
        organizationId: 'org-123',
        role: 'Project Manager',
        department: 'Construction',
      });

      expect(result).toBeDefined();
      expect(result.suggestedRole).toBe('editor');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.basedOnUsers).toBe(150);
      expect(result.suggestedCapabilities.perm_Read).toBe(true);
      expect(result.securityWarnings).toBeDefined();
    });

    it('should use rule-based suggestion when fewer than 10 similar users', async () => {
      // Mock only 5 similar users
      mockPrisma.userOrganization.findMany.mockResolvedValue([
        {
          id: 'userOrg-1',
          userId: 'user-1',
          organizationId: 'org-123',
          role: 'viewer',
          perm_Read: true,
          perm_EditForecast: false,
          perm_EditActuals: false,
          perm_Delete: false,
          perm_Import: false,
          perm_RefreshData: false,
          perm_Export: false,
          perm_ViewFinancials: false,
          perm_SaveDraft: false,
          perm_Sync: false,
          perm_ManageUsers: false,
          perm_ManageSettings: false,
          perm_ConfigureAlerts: false,
          perm_Impersonate: false,
          user: { id: 'user-1', username: 'user1', role: 'user' },
          organization: { id: 'org-123', code: 'HOLNG' },
        },
      ]);

      const result = await service.suggestPermissions({
        userId: 'new-user',
        organizationId: 'org-123',
        role: 'Project Manager',
        department: 'Construction',
      });

      expect(result).toBeDefined();
      expect(result.confidence).toBeLessThan(0.85); // Lower confidence for rule-based
      expect(result.basedOnUsers).toBe(1);
      expect(result.suggestedRole).toMatch(/admin|editor|viewer/);
    });

    it('should detect security risks for high-risk permissions', async () => {
      mockPrisma.userOrganization.findMany.mockResolvedValue([]);

      const result = await service.suggestPermissions({
        userId: 'new-user',
        organizationId: 'org-123',
        role: 'Admin',
        department: 'IT',
      });

      // Admin role should trigger multiple security warnings
      const warnings = result.securityWarnings;
      expect(warnings.length).toBeGreaterThan(0);

      // Check for specific warning types
      const hasFinancialWarning = warnings.some(
        (w) => w.capability.includes('ViewFinancials')
      );
      const hasDeleteWarning = warnings.some(
        (w) => w.capability === 'perm_Delete'
      );

      expect(hasFinancialWarning || hasDeleteWarning).toBe(true);
    });

    it('should cache suggestions for same role/department combinations', async () => {
      mockPrisma.userOrganization.findMany.mockResolvedValue([]);

      // First call
      await service.suggestPermissions({
        userId: 'user-1',
        organizationId: 'org-123',
        role: 'Project Manager',
        department: 'Construction',
      });

      // Second call with same role/department
      await service.suggestPermissions({
        userId: 'user-2',
        organizationId: 'org-123',
        role: 'Project Manager',
        department: 'Construction',
      });

      // Prisma should only be called once (second call uses cache)
      expect(mockPrisma.userOrganization.findMany).toHaveBeenCalledTimes(1);
    });

    it('should return low-confidence viewer permissions on error', async () => {
      mockPrisma.userOrganization.findMany.mockRejectedValue(
        new Error('Database error')
      );

      const result = await service.suggestPermissions({
        userId: 'new-user',
        organizationId: 'org-123',
        role: 'Unknown',
        department: 'Unknown',
      });

      expect(result.suggestedRole).toBe('viewer');
      expect(result.confidence).toBe(0.3);
      expect(result.basedOnUsers).toBe(0);
      expect(result.securityWarnings).toHaveLength(1);
      expect(result.securityWarnings[0].message).toContain('Manual review');
    });
  });

  describe('recordSuggestionOutcome', () => {
    it('should update audit log with acceptance status', async () => {
      mockPrisma.auditLog.update.mockResolvedValue({});

      await service.recordSuggestionOutcome('suggestion-123', true, {
        perm_Read: true,
        perm_EditForecast: true,
        perm_EditActuals: false,
        perm_Delete: false,
        perm_Import: false,
        perm_RefreshData: false,
        perm_Export: true,
        perm_ViewFinancials: false,
        perm_SaveDraft: true,
        perm_Sync: false,
        perm_ManageUsers: false,
        perm_ManageSettings: false,
        perm_ConfigureAlerts: false,
        perm_Impersonate: false,
      });

      expect(mockPrisma.auditLog.update).toHaveBeenCalledWith({
        where: { id: 'suggestion-123' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            wasAccepted: true,
          }),
        }),
      });
    });
  });

  describe('getSuggestionStats', () => {
    it('should calculate acceptance rate correctly', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          metadata: {
            wasAccepted: true,
            confidence: 0.9,
            output: { suggestedRole: 'editor' },
          },
        },
        {
          metadata: {
            wasAccepted: true,
            confidence: 0.85,
            output: { suggestedRole: 'editor' },
          },
        },
        {
          metadata: {
            wasAccepted: false,
            confidence: 0.6,
            output: { suggestedRole: 'viewer' },
          },
        },
      ]);

      const stats = await service.getSuggestionStats('org-123');

      expect(stats.totalSuggestions).toBe(3);
      expect(stats.acceptedCount).toBe(2);
      expect(stats.acceptanceRate).toBeCloseTo(0.667, 2);
      expect(stats.averageConfidence).toBeCloseTo(0.783, 2);
      expect(stats.byRole.editor).toEqual({ total: 2, accepted: 2 });
      expect(stats.byRole.viewer).toEqual({ total: 1, accepted: 0 });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing role and department gracefully', async () => {
      mockPrisma.userOrganization.findMany.mockResolvedValue([]);

      const result = await service.suggestPermissions({
        userId: 'new-user',
        organizationId: 'org-123',
      });

      expect(result).toBeDefined();
      expect(result.suggestedRole).toBe('viewer');
      expect(result.confidence).toBeLessThan(0.7);
    });

    it('should never auto-suggest perm_Impersonate permission', async () => {
      mockPrisma.userOrganization.findMany.mockResolvedValue([]);

      const result = await service.suggestPermissions({
        userId: 'new-user',
        organizationId: 'org-123',
        role: 'Super Admin',
        department: 'IT',
      });

      expect(result.suggestedCapabilities.perm_Impersonate).toBe(false);

      // If somehow suggested, should have CRITICAL warning
      if (result.suggestedCapabilities.perm_Impersonate) {
        const impersonateWarning = result.securityWarnings.find(
          (w) => w.capability === 'perm_Impersonate'
        );
        expect(impersonateWarning?.risk).toBe('CRITICAL');
      }
    });
  });
});
