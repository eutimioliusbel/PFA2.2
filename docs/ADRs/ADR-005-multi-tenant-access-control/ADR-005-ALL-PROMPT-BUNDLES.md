# ADR-005: Complete Prompt Bundle Collection
## Multi-Tenant Access Control Implementation (Phases 6-10)

**Status**: ✅ Complete | **Total Tasks**: 31 | **Generated**: 2025-11-27

---

## 📋 Quick Navigation

### Phase 6: AI Foundation (5 tasks)
- [Task 6.1: AI Permission Suggestion Engine](#task-61-ai-permission-suggestion-engine)
- [Task 6.2: AI Security Anomaly Detection](#task-62-ai-security-anomaly-detection)
- [Task 6.3: AI Financial Access Monitoring](#task-63-ai-financial-access-monitoring)
- [Task 6.4: AI Natural Language Permission Queries](#task-64-ai-natural-language-permission-queries)
- [Task 6.5: AI Data Hooks Implementation](#task-65-ai-data-hooks-implementation)

### Phase 7: UX Intelligence (5 tasks)
- [Task 7.1: Context-Aware Access Explanation](#task-71-context-aware-access-explanation)
- [Task 7.2: Financial Data Masking](#task-72-financial-data-masking)
- [Task 7.3: Semantic Audit Search](#task-73-semantic-audit-search)
- [Task 7.4: Role Drift Detection](#task-74-role-drift-detection)
- [Task 7.5: Behavioral Quiet Mode](#task-75-behavioral-quiet-mode)

### Phase 8: BEO Intelligence (5 tasks)
- [Task 8.1: Boardroom Voice Analyst](#task-81-boardroom-voice-analyst)
- [Task 8.2: Narrative Variance Generator](#task-82-narrative-variance-generator)
- [Task 8.3: Asset Arbitrage Detector](#task-83-asset-arbitrage-detector)
- [Task 8.4: Vendor Pricing Watchdog](#task-84-vendor-pricing-watchdog)
- [Task 8.5: Multiverse Scenario Simulator](#task-85-multiverse-scenario-simulator)

### Phase 9: AI Integration & Refinement (4 tasks)
- [Task 9.1: AI Model Performance Tuning](#task-91-ai-model-performance-tuning)
- [Task 9.2: AI Prompt Engineering](#task-92-ai-prompt-engineering)
- [Task 9.3: AI Caching Strategy](#task-93-ai-caching-strategy)
- [Task 9.4: AI Error Handling & Fallbacks](#task-94-ai-error-handling--fallbacks)

### Phase 10: Security & QA Gates (12 tasks)
**Phase 10A - Security Red Team**:
- [Task 10A.1: Privilege Escalation Testing](#task-10a1-privilege-escalation-testing)
- [Task 10A.2: Cross-Organization Access Testing](#task-10a2-cross-organization-access-testing-idor)
- [Task 10A.3: Financial Masking Bypass Testing](#task-10a3-financial-masking-bypass-testing)
- [Task 10A.4: API Server Security Audit](#task-10a4-api-server-security-audit)
- [Task 10A.5: JWT Tampering Testing](#task-10a5-jwt-tampering-testing)
- [Task 10A.6: Rate Limiting Bypass Testing](#task-10a6-rate-limiting-bypass-testing)

**Phase 10B - QA & Testing**:
- [Task 10B.1: Integration Test Suite](#task-10b1-integration-test-suite)
- [Task 10B.2: E2E Permission Workflow Tests](#task-10b2-e2e-permission-workflow-tests)
- [Task 10B.3: Load Testing](#task-10b3-load-testing)
- [Task 10B.4: Performance Benchmarking](#task-10b4-performance-benchmarking)
- [Task 10B.5: Accessibility Compliance Testing](#task-10b5-accessibility-compliance-testing)
- [Task 10B.6: Documentation Review](#task-10b6-documentation-review)

---

## 📖 How to Use This Document

**For AI Agents**:
1. Navigate to the desired task using the table of contents
2. Copy the entire prompt bundle for that task (from the task header to the next horizontal rule)
3. Paste into a chat session with the specified agent tag (e.g., `@ai-systems-architect`)

**For Human Developers**:
1. Use each bundle as a comprehensive implementation guide
2. Follow the "YOUR MISSION" section step-by-step
3. Use verification questions as quality gates

---

## 🤖 Phase 6: AI Foundation

**Duration**: 2 days | **Prerequisites**: Phase 5 Complete

---

# ADR-005 Phase 6: AI Foundation - Complete Prompt Bundles

**Phase**: 6 - AI Foundation & Context-Aware Help
**Duration**: 2-3 days
**Prerequisites**: ✅ Phase 2 (Backend Authorization) + Phase 4 (Frontend Permissions) Complete

---

## 📋 Table of Contents

1. [Task 6.1: AI Permission Suggestion Engine](#task-61-ai-permission-suggestion-engine)
2. [Task 6.2: AI Security Anomaly Detection](#task-62-ai-security-anomaly-detection)
3. [Task 6.3: AI Financial Access Monitoring](#task-63-ai-financial-access-monitoring)
4. [Task 6.4: AI Natural Language Permission Queries](#task-64-ai-natural-language-permission-queries)
5. [Task 6.5: AI Data Hooks Implementation](#task-65-ai-data-hooks-implementation)

---

## Task 6.1: AI Permission Suggestion Engine

### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@ai-systems-architect

**SYSTEM CONTEXT**:
You are executing Phase 6, Task 6.1 of ADR-005 Multi-Tenant Access Control.

PFA Vanguard is a construction equipment tracking system managing Plan/Forecast/Actuals for 1M+ records across multiple organizations (HOLNG, RIO, PEMS_Global, etc.). The system uses:
- Backend: Express.js + Prisma ORM + PostgreSQL
- Frontend: React 19 + TypeScript + Tailwind CSS
- AI Integration: Google Gemini AI + OpenAI + Anthropic Claude

Phase 2 complete: Backend authorization middleware enforcing multi-tenant isolation.
Phase 4 complete: Frontend permission hooks (useCanRead, useCanWrite, etc.).

**Dependencies**:
- ✅ `backend/src/middleware/requirePermission.ts` (permission checking middleware)
- ✅ `backend/src/services/auth/authService.ts` (JWT authentication)
- ✅ `backend/prisma/schema.prisma` (User, UserOrganization models)
- ✅ AI provider configuration in environment variables

**BUSINESS CONTEXT** (from ADR-005-DECISION.md):

**Requirement #10**: "Granular Permission Management - Admins assign permissions per user per organization with 6 core permissions (canRead, canWrite, canDelete, canManageUsers, canSync, canManageSettings)."

**Requirement #11**: "Hybrid Role-Override System - Start with role templates (viewer, editor, admin, beo) but allow custom capability overrides via JSONB field."

**Problem Statement**: When admins add new users to organizations, they must manually determine appropriate permissions. This is error-prone and time-consuming. We need AI to suggest optimal permissions based on:
- User's role (Project Manager, Field Engineer, BEO Analyst, etc.)
- Department (Construction, Procurement, Finance)
- Historical permission patterns from similar users
- Organization security policies

**Success Criteria**:
1. AI analyzes 100+ similar user permission grants
2. Suggestion confidence >85% for common roles (PM, Engineer)
3. Response time <500ms (cached for common role/dept combinations)
4. Suggestions include reasoning + risk warnings

---

**TECHNICAL SPECIFICATION** (from ADR-005-IMPLEMENTATION_PLAN.md Phase 6.1):

### Backend Service Implementation

**File**: `backend/src/services/ai/PermissionSuggestionService.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { callAI } from '../aiProviderClient';

const prisma = new PrismaClient();

export interface PermissionSuggestionRequest {
  userId: string;
  organizationId: string;
  role?: string; // User's job role (e.g., "Project Manager")
  department?: string; // Department (e.g., "Construction")
}

export interface PermissionSuggestion {
  suggestedRole: 'viewer' | 'editor' | 'admin' | 'beo';
  suggestedCapabilities: {
    canRead: boolean;
    canWrite: boolean;
    canDelete: boolean;
    canManageUsers: boolean;
    canSync: boolean;
    canManageSettings: boolean;
    viewFinancialDetails?: boolean;
    exportWithFinancials?: boolean;
    bulkOperations?: boolean;
  };
  confidence: number; // 0-1
  reasoning: string;
  basedOnUsers: number; // How many similar users analyzed
  securityWarnings: Array<{
    capability: string;
    risk: 'LOW' | 'MEDIUM' | 'HIGH';
    message: string;
  }>;
}

export class PermissionSuggestionService {
  /**
   * AI-Powered Permission Suggestion Engine (Use Case #1)
   *
   * Analyzes historical permission patterns to suggest optimal permissions
   * for new user-organization assignments.
   */
  async suggestPermissions(
    request: PermissionSuggestionRequest
  ): Promise<PermissionSuggestion> {
    // 1. Gather historical data for similar users
    const similarUsers = await this.findSimilarUsers(request);

    // 2. Calculate permission frequency distribution
    const permissionStats = this.calculatePermissionStatistics(similarUsers);

    // 3. Build AI prompt with context
    const prompt = this.buildSuggestionPrompt(request, permissionStats);

    // 4. Call AI provider
    const aiResponse = await callAI({
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      prompt,
      responseFormat: 'json',
      temperature: 0.3, // Lower temp for consistency
      maxTokens: 1000,
    });

    // 5. Parse and validate AI response
    const suggestion = JSON.parse(aiResponse.text) as PermissionSuggestion;

    // 6. Add security warnings based on capabilities
    suggestion.securityWarnings = this.detectSecurityRisks(
      suggestion.suggestedCapabilities
    );

    // 7. Log suggestion for future training
    await this.logSuggestion(request, suggestion);

    return suggestion;
  }

  /**
   * Find users with similar roles/departments for pattern analysis
   */
  private async findSimilarUsers(request: PermissionSuggestionRequest) {
    const { role, department, organizationId } = request;

    // Query for users with same role/department across all orgs
    const similarUsers = await prisma.userOrganization.findMany({
      where: {
        OR: [
          // Same role, same department
          role ? { user: { metadata: { path: ['role'], equals: role } } } : {},
          department ? { user: { metadata: { path: ['department'], equals: department } } } : {},
        ],
        // Include users from same organization for org-specific patterns
        organization: {
          OR: [
            { id: organizationId },
            { isExternal: false }, // Include local orgs for general patterns
          ],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            metadata: true, // Contains role, department, etc.
          },
        },
        organization: {
          select: {
            id: true,
            code: true,
          },
        },
      },
      take: 500, // Analyze up to 500 similar users
    });

    return similarUsers;
  }

  /**
   * Calculate frequency distribution of permissions across similar users
   */
  private calculatePermissionStatistics(users: any[]) {
    const stats = {
      roleDistribution: {} as Record<string, number>,
      capabilityFrequency: {
        canRead: 0,
        canWrite: 0,
        canDelete: 0,
        canManageUsers: 0,
        canSync: 0,
        canManageSettings: 0,
      },
      customCapabilityFrequency: {} as Record<string, number>,
      totalUsers: users.length,
    };

    users.forEach((userOrg) => {
      // Count role distribution
      stats.roleDistribution[userOrg.role] =
        (stats.roleDistribution[userOrg.role] || 0) + 1;

      // Count core capability frequency
      if (userOrg.canRead) stats.capabilityFrequency.canRead++;
      if (userOrg.canWrite) stats.capabilityFrequency.canWrite++;
      if (userOrg.canDelete) stats.capabilityFrequency.canDelete++;
      if (userOrg.canManageUsers) stats.capabilityFrequency.canManageUsers++;
      if (userOrg.canSync) stats.capabilityFrequency.canSync++;
      if (userOrg.canManageSettings) stats.capabilityFrequency.canManageSettings++;

      // Count custom capabilities from JSONB field
      if (userOrg.capabilities) {
        Object.entries(userOrg.capabilities).forEach(([key, value]) => {
          if (value === true) {
            stats.customCapabilityFrequency[key] =
              (stats.customCapabilityFrequency[key] || 0) + 1;
          }
        });
      }
    });

    // Convert counts to percentages
    const capabilityPercentages = Object.entries(stats.capabilityFrequency).reduce(
      (acc, [key, count]) => ({
        ...acc,
        [key]: ((count / stats.totalUsers) * 100).toFixed(1) + '%',
      }),
      {}
    );

    return {
      ...stats,
      capabilityPercentages,
    };
  }

  /**
   * Build AI prompt with historical data context
   */
  private buildSuggestionPrompt(
    request: PermissionSuggestionRequest,
    stats: any
  ): string {
    const { role, department } = request;

    return `
You are an access control expert for PFA Vanguard, a construction equipment tracking system.

**Task**: Suggest optimal permissions for a new user assignment.

**User Context**:
- Job Role: ${role || 'Unknown'}
- Department: ${department || 'Unknown'}
- Organization: Multi-tenant construction project

**Historical Permission Patterns** (${stats.totalUsers} similar users analyzed):

**Role Distribution**:
${Object.entries(stats.roleDistribution)
  .map(([role, count]) => `- ${role}: ${count} users (${((count as number / stats.totalUsers) * 100).toFixed(1)}%)`)
  .join('\n')}

**Permission Frequency** (% of similar users granted):
- canRead: ${stats.capabilityPercentages.canRead}
- canWrite: ${stats.capabilityPercentages.canWrite}
- canDelete: ${stats.capabilityPercentages.canDelete}
- canManageUsers: ${stats.capabilityPercentages.canManageUsers}
- canSync: ${stats.capabilityPercentages.canSync}
- canManageSettings: ${stats.capabilityPercentages.canManageSettings}

**Custom Capabilities** (optional, granted to <30% of users):
${Object.entries(stats.customCapabilityFrequency)
  .filter(([_, count]) => (count as number / stats.totalUsers) < 0.3)
  .map(([cap, count]) => `- ${cap}: ${((count as number / stats.totalUsers) * 100).toFixed(1)}%`)
  .join('\n')}

**Available Roles**:
- \`viewer\`: Read-only access (canRead only)
- \`editor\`: Read + write access (canRead, canWrite, optional bulkOperations)
- \`admin\`: Full control (all permissions)
- \`beo\`: Business Executive Overhead (cross-org analytics, viewFinancialDetails)

**Your Task**:
1. Recommend a \`suggestedRole\` (viewer | editor | admin | beo)
2. Recommend \`suggestedCapabilities\` (core + custom capabilities)
3. Provide \`reasoning\` (1-2 sentences explaining why)
4. Estimate \`confidence\` (0-1) based on data quality
5. Include \`basedOnUsers\` count

**Response Format** (JSON):
\`\`\`json
{
  "suggestedRole": "editor",
  "suggestedCapabilities": {
    "canRead": true,
    "canWrite": true,
    "canDelete": false,
    "canManageUsers": false,
    "canSync": true,
    "canManageSettings": false,
    "viewFinancialDetails": false,
    "bulkOperations": true
  },
  "confidence": 0.92,
  "reasoning": "Based on 150 Project Managers in Construction, 85% have editor role with sync capability.",
  "basedOnUsers": 150
}
\`\`\`

**Important**:
- Higher confidence (>0.9) if role/department patterns are strong
- Lower confidence (<0.7) if few similar users or conflicting patterns
- DO NOT suggest \`canManageSettings\` unless >80% of similar users have it
- DO NOT suggest \`viewFinancialDetails\` for non-BEO/admin roles unless explicitly common
`;
  }

  /**
   * Detect security risks in suggested capabilities
   */
  private detectSecurityRisks(capabilities: any) {
    const warnings: Array<{
      capability: string;
      risk: 'LOW' | 'MEDIUM' | 'HIGH';
      message: string;
    }> = [];

    // High risk: Financial data access
    if (capabilities.viewFinancialDetails) {
      warnings.push({
        capability: 'viewFinancialDetails',
        risk: 'MEDIUM',
        message: 'Grants access to cost data. Ensure user has signed NDA.',
      });
    }

    if (capabilities.exportWithFinancials) {
      warnings.push({
        capability: 'exportWithFinancials',
        risk: 'HIGH',
        message: 'Allows exporting financial data. Requires approval from Finance department.',
      });
    }

    // Medium risk: Sync permissions
    if (capabilities.canSync) {
      warnings.push({
        capability: 'canSync',
        risk: 'MEDIUM',
        message: 'Allows PEMS data synchronization. User should be trained on sync workflows.',
      });
    }

    // High risk: User management
    if (capabilities.canManageUsers) {
      warnings.push({
        capability: 'canManageUsers',
        risk: 'HIGH',
        message: 'Grants permission to add/remove users. Requires admin approval.',
      });
    }

    // Critical risk: Delete permissions
    if (capabilities.canDelete) {
      warnings.push({
        capability: 'canDelete',
        risk: 'HIGH',
        message: 'Allows permanent deletion of PFA records. Use with caution.',
      });
    }

    return warnings;
  }

  /**
   * Log suggestion for future AI training
   */
  private async logSuggestion(
    request: PermissionSuggestionRequest,
    suggestion: PermissionSuggestion
  ) {
    await prisma.aiSuggestionLog.create({
      data: {
        type: 'permission_suggestion',
        userId: request.userId,
        organizationId: request.organizationId,
        input: request,
        output: suggestion,
        confidence: suggestion.confidence,
        wasAccepted: false, // Will be updated if admin accepts
        createdAt: new Date(),
      },
    });
  }
}
```

---

### API Controller Implementation

**File**: `backend/src/controllers/ai/permissionSuggestionController.ts`

```typescript
import { Request, Response } from 'express';
import { PermissionSuggestionService } from '../../services/ai/PermissionSuggestionService';

const service = new PermissionSuggestionService();

/**
 * POST /api/ai/suggest-permissions
 *
 * Request Body:
 * {
 *   "userId": "user-123",
 *   "organizationId": "org-456",
 *   "role": "Project Manager",
 *   "department": "Construction"
 * }
 *
 * Response:
 * {
 *   "suggestedRole": "editor",
 *   "suggestedCapabilities": { ... },
 *   "confidence": 0.92,
 *   "reasoning": "...",
 *   "basedOnUsers": 150,
 *   "securityWarnings": [...]
 * }
 */
export async function suggestPermissions(req: Request, res: Response) {
  try {
    const { userId, organizationId, role, department } = req.body;

    // Validate request
    if (!userId || !organizationId) {
      return res.status(400).json({
        error: 'userId and organizationId are required',
      });
    }

    // Check if requesting user has permission to manage users
    const requestingUser = (req as any).user; // From auth middleware
    const canManage = await checkCanManageUsers(
      requestingUser.id,
      organizationId
    );

    if (!canManage) {
      return res.status(403).json({
        error: 'You do not have permission to manage users in this organization',
      });
    }

    // Generate AI suggestion
    const suggestion = await service.suggestPermissions({
      userId,
      organizationId,
      role,
      department,
    });

    res.json(suggestion);
  } catch (error) {
    console.error('Permission suggestion error:', error);
    res.status(500).json({
      error: 'Failed to generate permission suggestion',
      details: error.message,
    });
  }
}

/**
 * POST /api/ai/accept-suggestion
 *
 * Log when admin accepts/rejects AI suggestion (for training)
 */
export async function acceptSuggestion(req: Request, res: Response) {
  try {
    const { suggestionId, accepted, actualPermissions } = req.body;

    await prisma.aiSuggestionLog.update({
      where: { id: suggestionId },
      data: {
        wasAccepted: accepted,
        actualOutput: actualPermissions,
        acceptedAt: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Accept suggestion error:', error);
    res.status(500).json({ error: 'Failed to log suggestion acceptance' });
  }
}

// Helper function
async function checkCanManageUsers(userId: string, organizationId: string) {
  const userOrg = await prisma.userOrganization.findUnique({
    where: {
      userId_organizationId: { userId, organizationId },
    },
  });

  return userOrg?.canManageUsers || false;
}
```

---

### Frontend Integration

**File**: `components/admin/UserPermissionModal.tsx`

```tsx
import { useState, useEffect } from 'react';
import { Lightbulb, AlertTriangle, CheckCircle } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface UserPermissionModalProps {
  userId: string;
  organizationId: string;
  onSave: (permissions: any) => void;
  onClose: () => void;
}

export function UserPermissionModal({
  userId,
  organizationId,
  onSave,
  onClose,
}: UserPermissionModalProps) {
  const [suggestion, setSuggestion] = useState<any>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');
  const [permissions, setPermissions] = useState({
    canRead: false,
    canWrite: false,
    canDelete: false,
    canManageUsers: false,
    canSync: false,
    canManageSettings: false,
  });

  // Fetch AI suggestion when role/department changes
  const fetchSuggestion = async () => {
    if (!role && !department) return;

    setLoadingSuggestion(true);
    try {
      const result = await apiClient.suggestPermissions({
        userId,
        organizationId,
        role,
        department,
      });
      setSuggestion(result);
    } catch (error) {
      console.error('Failed to fetch AI suggestion:', error);
    } finally {
      setLoadingSuggestion(false);
    }
  };

  // Apply AI suggestion
  const applySuggestion = () => {
    if (!suggestion) return;

    setPermissions(suggestion.suggestedCapabilities);

    // Log suggestion acceptance
    apiClient.acceptSuggestion({
      suggestionId: suggestion.id,
      accepted: true,
      actualPermissions: suggestion.suggestedCapabilities,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
        <h2 className="text-2xl font-bold mb-4">Assign User Permissions</h2>

        {/* User Info */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Job Role
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              onBlur={fetchSuggestion}
              placeholder="e.g., Project Manager"
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Department
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              onBlur={fetchSuggestion}
              placeholder="e.g., Construction"
              className="w-full px-3 py-2 border rounded"
            />
          </div>
        </div>

        {/* AI Suggestion Panel */}
        {loadingSuggestion && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
              <span className="text-blue-700">
                Analyzing similar users...
              </span>
            </div>
          </div>
        )}

        {suggestion && !loadingSuggestion && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">
                  AI Suggestion (Confidence: {(suggestion.confidence * 100).toFixed(0)}%)
                </h3>
                <p className="text-sm text-blue-700 mb-3">
                  {suggestion.reasoning}
                </p>

                <div className="mb-3">
                  <p className="text-xs text-blue-600 mb-2">
                    Recommended Role: <span className="font-semibold">{suggestion.suggestedRole}</span>
                    {' '}(based on {suggestion.basedOnUsers} similar users)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(suggestion.suggestedCapabilities)
                      .filter(([_, value]) => value === true)
                      .map(([cap]) => (
                        <span
                          key={cap}
                          className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                        >
                          {cap}
                        </span>
                      ))}
                  </div>
                </div>

                {/* Security Warnings */}
                {suggestion.securityWarnings.length > 0 && (
                  <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-yellow-800 mb-1">
                          Security Warnings:
                        </p>
                        <ul className="text-xs text-yellow-700 space-y-1">
                          {suggestion.securityWarnings.map((warning: any, i: number) => (
                            <li key={i}>
                              <span className="font-semibold">{warning.capability}</span>
                              {' '}({warning.risk}): {warning.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={applySuggestion}
                  className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
                >
                  Apply AI Suggestion
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manual Permission Checkboxes */}
        <div className="mb-6">
          <h3 className="font-semibold mb-3">Permissions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'canRead', label: 'Can Read', desc: 'View PFA records' },
              { key: 'canWrite', label: 'Can Write', desc: 'Edit forecasts' },
              { key: 'canDelete', label: 'Can Delete', desc: 'Delete records' },
              { key: 'canSync', label: 'Can Sync', desc: 'PEMS sync access' },
              { key: 'canManageUsers', label: 'Manage Users', desc: 'Add/remove users' },
              { key: 'canManageSettings', label: 'Manage Settings', desc: 'Org config' },
            ].map((perm) => (
              <label key={perm.key} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={permissions[perm.key as keyof typeof permissions]}
                  onChange={(e) =>
                    setPermissions({ ...permissions, [perm.key]: e.target.checked })
                  }
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-sm">{perm.label}</div>
                  <div className="text-xs text-gray-500">{perm.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(permissions)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save Permissions
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### Database Migration

**File**: `backend/prisma/migrations/YYYYMMDDHHMMSS_add_ai_suggestion_log/migration.sql`

```sql
-- AI Suggestion Log table
CREATE TABLE "ai_suggestion_logs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL, -- 'permission_suggestion', 'financial_masking', etc.
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "input" JSONB NOT NULL, -- Request parameters
  "output" JSONB NOT NULL, -- AI suggestion
  "confidence" DOUBLE PRECISION NOT NULL,
  "wasAccepted" BOOLEAN DEFAULT false,
  "actualOutput" JSONB, -- What admin actually granted (if different)
  "acceptedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_suggestion_logs_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "ai_suggestion_logs_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "organizations"("id") ON DELETE CASCADE
);

CREATE INDEX "ai_suggestion_logs_type_createdAt_idx" ON "ai_suggestion_logs"("type", "createdAt");
CREATE INDEX "ai_suggestion_logs_userId_idx" ON "ai_suggestion_logs"("userId");
```

---

**AI ENFORCEMENT** (from ADR-005-AI_OPPORTUNITIES.md Use Case #1):

🚨 **MANDATORY AI DATA HOOKS**:
1. ✅ Store `UserOrganization.createdAt` timestamps (already exists)
2. ✅ Log permission changes with `modifiedBy` and `modifiedAt` (already exists in AuditLog)
3. ⚠️ **MUST ADD**: `User.metadata` JSONB field to store role/department
4. ⚠️ **MUST ADD**: `AiSuggestionLog` table to track AI suggestions and acceptance rate
5. ⚠️ **MUST ADD**: Permission change audit log enhancement to track "granted by AI suggestion" vs "manual"

**Why**: AI learns from historical patterns. Without role/department metadata, suggestions will have <60% confidence.

---

**UX ENFORCEMENT** (from ADR-005-UX_SPEC.md):

🚨 **MANDATORY UX REQUIREMENTS**:
1. **Confidence Indicator**: Show confidence percentage prominently (85% = green, 60-84% = yellow, <60% = orange)
2. **Security Warnings**: Display warnings in yellow panel with AlertTriangle icon
3. **Reasoning Transparency**: Always show "Based on X similar users" count
4. **One-Click Apply**: "Apply AI Suggestion" button must populate all checkboxes
5. **Manual Override**: Users can modify AI suggestion before saving
6. **Feedback Loop**: Track whether admin accepted/rejected suggestion for training

---

**YOUR MISSION**:

**Step 1: Database Schema** (30 minutes)
- Add `User.metadata` JSONB field via Prisma migration
- Add `AiSuggestionLog` table
- Update `AuditLog` to track AI-suggested permissions

**Step 2: Backend Service** (2 hours)
- Implement `PermissionSuggestionService.suggestPermissions()`
- Implement `findSimilarUsers()` query (find users with same role/dept)
- Implement `calculatePermissionStatistics()` (frequency analysis)
- Implement `buildSuggestionPrompt()` (AI prompt engineering)
- Implement `detectSecurityRisks()` (warning generation)

**Step 3: AI Provider Integration** (1 hour)
- Ensure `callAI()` function supports Gemini Flash model
- Add caching layer for common role/dept combinations (Redis)
- Add retry logic for AI provider failures

**Step 4: API Controller** (1 hour)
- Create `POST /api/ai/suggest-permissions` endpoint
- Add permission check (only users with `canManageUsers` can access)
- Add request validation
- Create `POST /api/ai/accept-suggestion` endpoint for feedback

**Step 5: Frontend Integration** (2 hours)
- Create `UserPermissionModal` component
- Add AI suggestion panel with confidence indicator
- Add security warnings display
- Add "Apply AI Suggestion" button
- Add manual permission checkboxes
- Integrate into User Management page

**Step 6: Testing** (1 hour)
- Unit test: `calculatePermissionStatistics()` with mock data
- Integration test: AI suggestion API endpoint
- E2E test: User permission modal workflow
- Load test: Suggestion response time <500ms

**Step 7: Documentation** (30 minutes)
- Update API documentation with `/api/ai/suggest-permissions` endpoint
- Add usage examples for admins
- Document training data requirements

---

**DELIVERABLES**:

1. **Backend**:
   - `backend/src/services/ai/PermissionSuggestionService.ts` (300+ lines)
   - `backend/src/controllers/ai/permissionSuggestionController.ts` (150+ lines)
   - `backend/prisma/migrations/*/migration.sql` (AI Suggestion Log table)
   - `backend/prisma/schema.prisma` (updated User and AiSuggestionLog models)

2. **Frontend**:
   - `components/admin/UserPermissionModal.tsx` (200+ lines)
   - `services/apiClient.ts` (add `suggestPermissions()` and `acceptSuggestion()` methods)

3. **Tests**:
   - `backend/tests/unit/permissionSuggestionService.test.ts`
   - `backend/tests/integration/aiSuggestionAPI.test.ts`
   - `frontend/tests/e2e/userPermissionModal.test.tsx`

4. **Documentation**:
   - `docs/AI_PERMISSION_SUGGESTIONS.md` (usage guide)
   - Update `docs/backend/API_REFERENCE.md` with AI endpoints

---

**CONSTRAINTS**:

❌ **DO NOT**:
- Store AI API keys in code (use environment variables)
- Return suggestions for users without `canManageUsers` permission
- Cache suggestions for >24 hours (permissions change frequently)
- Suggest `canDelete` or `canManageUsers` unless >90% of similar users have it
- Skip security warnings (always include for sensitive capabilities)

✅ **DO**:
- Log every AI suggestion for training data (accepted + rejected)
- Use lower AI temperature (0.3) for consistency
- Fail gracefully if AI provider is unavailable (return empty suggestion with low confidence)
- Show confidence percentage prominently in UI
- Allow admins to override AI suggestions
- Track acceptance rate per role/department for quality monitoring

---

**VERIFICATION QUESTIONS**:

Before marking this task complete, answer:

1. ✅ Does the AI analyze at least 100 similar users (or return low confidence if <100)?
2. ✅ Is confidence >85% for common roles (Project Manager, Field Engineer, BEO Analyst)?
3. ✅ Does response time stay <500ms for cached role/department combinations?
4. ✅ Are security warnings displayed for `viewFinancialDetails`, `canDelete`, `canManageUsers`?
5. ✅ Is suggestion acceptance/rejection logged for AI training?
6. ✅ Can admins manually override AI suggestions before saving?
7. ✅ Does the UI show "Based on X similar users" count?
8. ✅ Is the `User.metadata` JSONB field populated with role/department on user creation?

**DEFINITION OF DONE**:
- ✅ `POST /api/ai/suggest-permissions` returns suggestions in <500ms
- ✅ AI confidence >85% for roles with 100+ historical examples
- ✅ Security warnings appear for all high-risk capabilities
- ✅ Admins can apply or modify suggestions in UserPermissionModal
- ✅ All suggestions logged to `AiSuggestionLog` table
- ✅ Unit tests pass (95%+ coverage for PermissionSuggestionService)
- ✅ Integration tests pass (AI endpoint + feedback loop)
- ✅ E2E tests pass (full permission grant workflow)
- ✅ Documentation complete (API reference + usage guide)
```

**Status**: ⬜ Not Started

---

## Task 6.2: AI Security Anomaly Detection

### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@ai-security-red-teamer

**SYSTEM CONTEXT**:
You are executing Phase 6, Task 6.2 of ADR-005 Multi-Tenant Access Control.

PFA Vanguard is a construction equipment tracking system with 1M+ records. Security is critical because:
- Financial data (cost, monthlyRate, purchasePrice) is sensitive
- Multiple organizations (HOLNG, RIO, PEMS_Global) must stay isolated
- PEMS sync operations can affect external systems
- User permission escalation could lead to data breaches

Phase 2 complete: Backend authorization with multi-tenant isolation.
Phase 4 complete: Frontend permission enforcement.
Task 6.1 complete: AI Permission Suggestion Engine.

**Dependencies**:
- ✅ `backend/src/middleware/auth.ts` (JWT authentication with `lastLoginAt`, `lastLoginIp`)
- ✅ `backend/prisma/schema.prisma` (User model with `failedLoginCount`, `lockedAt`)
- ✅ `backend/src/services/pems/PemsSyncService.ts` (PEMS sync operations)
- ✅ AI provider configuration

**BUSINESS CONTEXT** (from ADR-005-DECISION.md):

**Requirement #17**: "Security Monitoring - System must detect and alert on suspicious access patterns (e.g., user accessing 5 organizations in 10 minutes, unusual bulk operations, off-hours financial data exports)."

**Problem Statement**: Manual security monitoring is reactive and slow. We need AI to detect anomalies in real-time:
- **Login Anomalies**: User logs in from new country, unusual time (2am), rapid org switching
- **Permission Anomalies**: User granted 5 new capabilities in 48 hours (privilege escalation)
- **Data Access Anomalies**: User exports 10x normal record count, accesses financial data at 2am
- **Sync Anomalies**: Failed sync rate >20% (potential PEMS API key compromise)

**Success Criteria**:
1. Detect anomalies within 5 minutes of occurrence
2. <5% false positive rate (don't alert on normal behavior)
3. Auto-suspend users for CRITICAL risk events
4. Generate actionable alerts with investigation steps

---

**TECHNICAL SPECIFICATION** (from ADR-005-IMPLEMENTATION_PLAN.md Phase 6.2):

### Backend Service Implementation

**File**: `backend/src/services/ai/AnomalyDetectionService.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { callAI } from '../aiProviderClient';

const prisma = new PrismaClient();

export interface AnomalyAlert {
  alertType:
    | 'LOGIN_ANOMALY'
    | 'PERMISSION_ESCALATION'
    | 'DATA_ACCESS_ANOMALY'
    | 'SYNC_FAILURE_SPIKE'
    | 'UNUSUAL_BULK_OPERATION';
  userId: string;
  organizationId?: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  anomaly: string; // Human-readable description
  details: any; // Structured data (IPs, timestamps, counts)
  reasoning: string; // Why AI flagged this
  suggestedAction: string;
  confidence: number;
  detectedAt: Date;
}

export class AnomalyDetectionService {
  /**
   * AI Security Anomaly Detection (Use Case #2)
   *
   * Monitors user access patterns and alerts on suspicious behavior
   */

  /**
   * Monitor login patterns for anomalies
   */
  async detectLoginAnomalies(userId: string): Promise<AnomalyAlert | null> {
    // Get user's login history (last 90 days)
    const loginHistory = await prisma.auditLog.findMany({
      where: {
        userId,
        action: 'user_login',
        createdAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    // Get latest login event
    const latestLogin = loginHistory[0];
    if (!latestLogin) return null;

    // Extract patterns from history
    const normalPattern = this.calculateLoginPattern(loginHistory);
    const currentLogin = {
      timestamp: latestLogin.createdAt,
      ipAddress: latestLogin.metadata?.ipAddress,
      userAgent: latestLogin.metadata?.userAgent,
      location: latestLogin.metadata?.location, // Geolocation from IP
    };

    // Build AI prompt
    const prompt = `
You are a security analyst for PFA Vanguard detecting login anomalies.

**Normal Login Pattern** (based on 90 days):
- Typical login hours: ${normalPattern.peakHours.join(', ')}
- Typical locations: ${normalPattern.locations.join(', ')}
- Average logins per day: ${normalPattern.avgLoginsPerDay}
- Typical devices: ${normalPattern.devices.join(', ')}

**Current Login Attempt**:
- Timestamp: ${currentLogin.timestamp}
- IP Address: ${currentLogin.ipAddress}
- Location: ${currentLogin.location?.city}, ${currentLogin.location?.country}
- User Agent: ${currentLogin.userAgent}

**Detect Anomalies**:
1. Is this login time unusual? (e.g., 2am when user normally logs in 9am-5pm)
2. Is this location unusual? (e.g., Nigeria when user normally in USA)
3. Is this device/browser unusual? (e.g., Linux when user normally uses Windows)
4. Has there been rapid login/logout activity? (e.g., 10 logins in 5 minutes)

**Response Format** (JSON):
If anomaly detected:
\`\`\`json
{
  "anomalyDetected": true,
  "risk": "HIGH",
  "anomaly": "Login from Nigeria at 2:17am (user typically logs in from USA during business hours)",
  "reasoning": "Geographic location and time are both outside normal patterns",
  "suggestedAction": "Require MFA verification and notify user via email",
  "confidence": 0.89
}
\`\`\`

If no anomaly:
\`\`\`json
{
  "anomalyDetected": false,
  "confidence": 0.95
}
\`\`\`
`;

    const aiResponse = await callAI({
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      prompt,
      responseFormat: 'json',
      temperature: 0.2, // Low temp for security consistency
    });

    const analysis = JSON.parse(aiResponse.text);

    if (!analysis.anomalyDetected) return null;

    // Create alert
    const alert: AnomalyAlert = {
      alertType: 'LOGIN_ANOMALY',
      userId,
      risk: analysis.risk,
      anomaly: analysis.anomaly,
      details: {
        currentLogin,
        normalPattern,
      },
      reasoning: analysis.reasoning,
      suggestedAction: analysis.suggestedAction,
      confidence: analysis.confidence,
      detectedAt: new Date(),
    };

    // Log alert
    await this.logAnomaly(alert);

    // Auto-action for CRITICAL risk
    if (alert.risk === 'CRITICAL') {
      await this.autoSuspendUser(userId, alert.anomaly);
    }

    return alert;
  }

  /**
   * Detect permission escalation patterns
   */
  async detectPermissionEscalation(userId: string): Promise<AnomalyAlert | null> {
    // Get permission changes in last 7 days
    const permissionChanges = await prisma.auditLog.findMany({
      where: {
        resource: 'user_organization',
        action: 'permission_grant',
        metadata: {
          path: ['userId'],
          equals: userId,
        },
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (permissionChanges.length === 0) return null;

    // Extract granted capabilities
    const capabilitiesGranted = permissionChanges.flatMap((change) =>
      Object.keys(change.metadata?.changes || {}).filter(
        (key) => change.metadata?.changes[key] === true
      )
    );

    // Check for rapid escalation
    const highRiskCapabilities = [
      'canManageUsers',
      'canManageSettings',
      'viewFinancialDetails',
      'canDelete',
    ];

    const highRiskGranted = capabilitiesGranted.filter((cap) =>
      highRiskCapabilities.includes(cap)
    );

    if (highRiskGranted.length >= 2 && permissionChanges.length >= 3) {
      // Suspicious: 2+ high-risk capabilities granted in 3+ separate actions within 7 days
      const alert: AnomalyAlert = {
        alertType: 'PERMISSION_ESCALATION',
        userId,
        risk: 'HIGH',
        anomaly: `User granted ${highRiskGranted.length} high-risk capabilities in ${permissionChanges.length} permission changes over ${permissionChanges.length} days`,
        details: {
          capabilitiesGranted: highRiskGranted,
          permissionChangeCount: permissionChanges.length,
          timeSpan: '7 days',
          grantedBy: permissionChanges.map((c) => c.userId).filter(
            (v, i, a) => a.indexOf(v) === i
          ), // Unique grantors
        },
        reasoning:
          'Rapid accumulation of high-risk capabilities is unusual and may indicate compromised admin account',
        suggestedAction:
          'Review with admins who granted these capabilities. Verify user identity.',
        confidence: 0.87,
        detectedAt: new Date(),
      };

      await this.logAnomaly(alert);
      return alert;
    }

    return null;
  }

  /**
   * Detect unusual data access patterns (financial data exports)
   */
  async detectDataAccessAnomaly(userId: string): Promise<AnomalyAlert | null> {
    // Get user's data access history (last 30 days)
    const accessHistory = await prisma.auditLog.findMany({
      where: {
        userId,
        action: 'pfa_records_export',
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    if (accessHistory.length === 0) return null;

    // Calculate normal pattern
    const normalPattern = {
      avgRecordsPerExport:
        accessHistory.reduce(
          (sum, log) => sum + (log.metadata?.recordCount || 0),
          0
        ) / accessHistory.length,
      peakHours: this.extractPeakHours(
        accessHistory.map((log) => log.createdAt)
      ),
      includesFinancials:
        accessHistory.filter((log) => log.metadata?.includesFinancials)
          .length / accessHistory.length,
    };

    // Get latest export
    const latestExport = accessHistory[0];
    const currentExport = {
      recordCount: latestExport.metadata?.recordCount || 0,
      includesFinancials: latestExport.metadata?.includesFinancials || false,
      timestamp: latestExport.createdAt,
      ipAddress: latestExport.metadata?.ipAddress,
    };

    // Check for anomalies
    const recordCountMultiplier =
      currentExport.recordCount / normalPattern.avgRecordsPerExport;

    const hour = currentExport.timestamp.getHours();
    const isOffHours =
      !normalPattern.peakHours.includes(hour) && (hour < 7 || hour > 20);

    if (
      recordCountMultiplier > 10 ||
      (currentExport.includesFinancials && isOffHours)
    ) {
      const alert: AnomalyAlert = {
        alertType: 'DATA_ACCESS_ANOMALY',
        userId,
        risk: isOffHours && currentExport.includesFinancials ? 'CRITICAL' : 'HIGH',
        anomaly: `User exported ${currentExport.recordCount} records (${recordCountMultiplier.toFixed(1)}x normal) ${isOffHours ? 'at unusual time' : ''} ${currentExport.includesFinancials ? 'with financial data' : ''}`,
        details: {
          currentExport,
          normalPattern,
          recordCountMultiplier,
        },
        reasoning: `User typically exports ${normalPattern.avgRecordsPerExport.toFixed(0)} records during ${normalPattern.peakHours.join(', ')}. This export is ${recordCountMultiplier}x larger${isOffHours ? ' and occurred during off-hours' : ''}`,
        suggestedAction:
          'Suspend user immediately. Notify security team. Review export destination.',
        confidence: 0.93,
        detectedAt: new Date(),
      };

      await this.logAnomaly(alert);

      // Auto-suspend for CRITICAL risk
      if (alert.risk === 'CRITICAL') {
        await this.autoSuspendUser(userId, alert.anomaly);
      }

      return alert;
    }

    return null;
  }

  /**
   * Monitor PEMS sync failure rates
   */
  async detectSyncAnomalies(organizationId: string): Promise<AnomalyAlert | null> {
    // Get sync history for organization (last 30 days)
    const syncHistory = await prisma.auditLog.findMany({
      where: {
        action: 'pems_sync',
        metadata: {
          path: ['organizationId'],
          equals: organizationId,
        },
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    if (syncHistory.length < 10) return null; // Need at least 10 syncs

    // Calculate failure rate
    const failedSyncs = syncHistory.filter(
      (log) => log.metadata?.status === 'failed'
    ).length;
    const failureRate = failedSyncs / syncHistory.length;

    // Normal failure rate should be <10%
    if (failureRate > 0.2) {
      // >20% failure rate
      const alert: AnomalyAlert = {
        alertType: 'SYNC_FAILURE_SPIKE',
        organizationId,
        userId: 'system',
        risk: 'HIGH',
        anomaly: `PEMS sync failure rate ${(failureRate * 100).toFixed(1)}% (${failedSyncs}/${syncHistory.length} syncs) for org ${organizationId}`,
        details: {
          failureRate,
          failedSyncs,
          totalSyncs: syncHistory.length,
          recentErrors: syncHistory
            .filter((log) => log.metadata?.status === 'failed')
            .slice(0, 5)
            .map((log) => log.metadata?.error),
        },
        reasoning:
          'High sync failure rate may indicate PEMS API key rotation, network issues, or compromised credentials',
        suggestedAction:
          'Verify PEMS API credentials. Check PEMS API status. Review error logs.',
        confidence: 0.91,
        detectedAt: new Date(),
      };

      await this.logAnomaly(alert);
      return alert;
    }

    return null;
  }

  /**
   * Helper: Calculate login pattern from history
   */
  private calculateLoginPattern(loginHistory: any[]) {
    const hours = loginHistory.map((log) => log.createdAt.getHours());
    const locations = loginHistory.map(
      (log) =>
        `${log.metadata?.location?.city || 'Unknown'}, ${log.metadata?.location?.country || 'Unknown'}`
    );
    const devices = loginHistory.map(
      (log) => log.metadata?.userAgent || 'Unknown'
    );

    // Find peak hours (hours with most logins)
    const hourCounts = hours.reduce((acc, hour) => {
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const peakHours = Object.entries(hourCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    return {
      peakHours,
      locations: [...new Set(locations)].slice(0, 3), // Top 3 locations
      devices: [...new Set(devices)].slice(0, 3), // Top 3 devices
      avgLoginsPerDay: loginHistory.length / 90,
    };
  }

  /**
   * Helper: Extract peak hours from timestamps
   */
  private extractPeakHours(timestamps: Date[]): number[] {
    const hourCounts = timestamps.reduce((acc, ts) => {
      const hour = ts.getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return Object.entries(hourCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));
  }

  /**
   * Log anomaly to database
   */
  private async logAnomaly(alert: AnomalyAlert) {
    await prisma.securityAlert.create({
      data: {
        alertType: alert.alertType,
        userId: alert.userId,
        organizationId: alert.organizationId,
        risk: alert.risk,
        anomaly: alert.anomaly,
        details: alert.details,
        reasoning: alert.reasoning,
        suggestedAction: alert.suggestedAction,
        confidence: alert.confidence,
        detectedAt: alert.detectedAt,
        acknowledged: false,
      },
    });

    // Send real-time notification to security team
    await this.notifySecurityTeam(alert);
  }

  /**
   * Auto-suspend user for CRITICAL risk
   */
  private async autoSuspendUser(userId: string, reason: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        serviceStatus: 'suspended',
        suspendedAt: new Date(),
        suspensionReason: `AUTO-SUSPENDED: ${reason}`,
      },
    });

    // Notify user via email
    await this.notifyUser(userId, reason);
  }

  /**
   * Notify security team via Slack/email
   */
  private async notifySecurityTeam(alert: AnomalyAlert) {
    // TODO: Implement Slack webhook or email notification
    console.log('[SECURITY ALERT]', alert);
  }

  /**
   * Notify user of suspension
   */
  private async notifyUser(userId: string, reason: string) {
    // TODO: Implement user email notification
    console.log(`[USER SUSPENDED] User ${userId}: ${reason}`);
  }
}
```

---

### Background Worker Implementation

**File**: `backend/src/workers/anomalyDetectionWorker.ts`

```typescript
import { AnomalyDetectionService } from '../services/ai/AnomalyDetectionService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const anomalyService = new AnomalyDetectionService();

/**
 * Background worker that runs anomaly detection every 5 minutes
 */
export async function runAnomalyDetection() {
  console.log('[Anomaly Detection] Starting scan...');

  try {
    // Get all active users
    const activeUsers = await prisma.user.findMany({
      where: {
        serviceStatus: 'active',
        lastActivityAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Active in last 24 hours
        },
      },
      select: { id: true },
    });

    console.log(
      `[Anomaly Detection] Scanning ${activeUsers.length} active users...`
    );

    // Run parallel anomaly checks
    const checks = activeUsers.flatMap((user) => [
      anomalyService.detectLoginAnomalies(user.id),
      anomalyService.detectPermissionEscalation(user.id),
      anomalyService.detectDataAccessAnomaly(user.id),
    ]);

    const results = await Promise.allSettled(checks);

    const alertsDetected = results.filter(
      (r) => r.status === 'fulfilled' && r.value !== null
    ).length;

    console.log(`[Anomaly Detection] Detected ${alertsDetected} anomalies`);

    // Also check sync anomalies for all organizations
    const organizations = await prisma.organization.findMany({
      where: {
        serviceStatus: 'active',
        enableSync: true,
      },
      select: { id: true },
    });

    const syncChecks = organizations.map((org) =>
      anomalyService.detectSyncAnomalies(org.id)
    );

    await Promise.allSettled(syncChecks);

    console.log('[Anomaly Detection] Scan complete');
  } catch (error) {
    console.error('[Anomaly Detection] Scan failed:', error);
  }
}

// Run every 5 minutes
setInterval(runAnomalyDetection, 5 * 60 * 1000);

// Run immediately on startup
runAnomalyDetection();
```

---

### Database Migration

**File**: `backend/prisma/migrations/YYYYMMDDHHMMSS_add_security_alerts/migration.sql`

```sql
-- Security Alerts table
CREATE TABLE "security_alerts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "alertType" TEXT NOT NULL, -- 'LOGIN_ANOMALY', 'PERMISSION_ESCALATION', etc.
  "userId" TEXT NOT NULL,
  "organizationId" TEXT,
  "risk" TEXT NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  "anomaly" TEXT NOT NULL, -- Human-readable description
  "details" JSONB NOT NULL, -- Structured data
  "reasoning" TEXT NOT NULL, -- AI explanation
  "suggestedAction" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "detectedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledged" BOOLEAN DEFAULT false,
  "acknowledgedBy" TEXT,
  "acknowledgedAt" TIMESTAMP,
  "resolution" TEXT, -- How was it resolved
  "resolvedAt" TIMESTAMP,

  CONSTRAINT "security_alerts_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "security_alerts_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "organizations"("id") ON DELETE CASCADE
);

CREATE INDEX "security_alerts_risk_detectedAt_idx" ON "security_alerts"("risk", "detectedAt");
CREATE INDEX "security_alerts_userId_idx" ON "security_alerts"("userId");
CREATE INDEX "security_alerts_acknowledged_idx" ON "security_alerts"("acknowledged");
```

---

### Frontend Integration

**File**: `components/admin/SecurityAlertsPanel.tsx`

```tsx
import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

export function SecurityAlertsPanel() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'unacknowledged'>('unacknowledged');

  useEffect(() => {
    loadAlerts();
    // Poll for new alerts every 30 seconds
    const interval = setInterval(loadAlerts, 30 * 1000);
    return () => clearInterval(interval);
  }, [filter]);

  const loadAlerts = async () => {
    const data = await apiClient.getSecurityAlerts({ acknowledged: filter === 'all' ? undefined : false });
    setAlerts(data);
  };

  const handleAcknowledge = async (alertId: string, resolution: string) => {
    await apiClient.acknowledgeSecurityAlert(alertId, resolution);
    await loadAlerts();
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'CRITICAL':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'HIGH':
        return 'text-orange-700 bg-orange-50 border-orange-200';
      case 'MEDIUM':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'LOW':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Security Alerts</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'all' | 'unacknowledged')}
          className="px-3 py-2 border rounded"
        >
          <option value="unacknowledged">Unacknowledged Only</option>
          <option value="all">All Alerts</option>
        </select>
      </div>

      <div className="space-y-4">
        {alerts.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
            <p>No security alerts detected</p>
          </div>
        )}

        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-4 border rounded-lg ${getRiskColor(alert.risk)}`}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{alert.alertType.replace(/_/g, ' ')}</h3>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded">
                      {alert.risk} RISK
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(alert.detectedAt).toLocaleString()}</span>
                  </div>
                </div>

                <p className="text-sm mb-2">{alert.anomaly}</p>

                <div className="text-xs mb-3">
                  <p className="font-semibold">AI Analysis:</p>
                  <p>{alert.reasoning}</p>
                </div>

                <div className="text-xs mb-3 p-2 bg-white bg-opacity-50 rounded">
                  <p className="font-semibold">Suggested Action:</p>
                  <p>{alert.suggestedAction}</p>
                </div>

                {!alert.acknowledged && (
                  <button
                    onClick={() => {
                      const resolution = prompt('How was this resolved?');
                      if (resolution) handleAcknowledge(alert.id, resolution);
                    }}
                    className="px-4 py-2 bg-white border rounded hover:bg-gray-50 text-sm font-medium"
                  >
                    Acknowledge & Resolve
                  </button>
                )}

                {alert.acknowledged && (
                  <div className="text-xs text-gray-600">
                    <p>
                      ✓ Acknowledged by {alert.acknowledgedBy} on{' '}
                      {new Date(alert.acknowledgedAt).toLocaleString()}
                    </p>
                    <p>Resolution: {alert.resolution}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

**AI ENFORCEMENT** (from ADR-005-AI_OPPORTUNITIES.md Use Case #2):

🚨 **MANDATORY AI DATA HOOKS**:
1. ✅ Authentication logs in AuditLog (already exists)
2. ✅ Failed login tracking in User model (already exists)
3. ⚠️ **MUST ADD**: IP address tracking in AuditLog metadata
4. ⚠️ **MUST ADD**: Geolocation data from IP (use MaxMind GeoIP2 or similar)
5. ⚠️ **MUST ADD**: SecurityAlert table for anomaly storage
6. ⚠️ **MUST ADD**: Background worker to run scans every 5 minutes

**Why**: Real-time anomaly detection requires continuous monitoring. Batch processing (daily scans) is too slow for security threats.

---

**UX ENFORCEMENT** (from ADR-005-UX_SPEC.md):

🚨 **MANDATORY UX REQUIREMENTS**:
1. **Real-Time Alerts**: Security team sees new alerts within 30 seconds
2. **Risk Color Coding**: CRITICAL=red, HIGH=orange, MEDIUM=yellow, LOW=blue
3. **Actionable Suggestions**: Every alert includes specific investigation steps
4. **Acknowledgment Workflow**: Admins must provide resolution notes
5. **Alert History**: Show last 90 days of alerts (acknowledged + unacknowledged)
6. **Auto-Suspend Indicator**: Show badge if user was auto-suspended

---

**YOUR MISSION**:

**Step 1: Database Schema** (30 minutes)
- Add `SecurityAlert` model to Prisma schema
- Add IP address/geolocation fields to AuditLog metadata
- Run migration

**Step 2: Backend Service** (3 hours)
- Implement `AnomalyDetectionService` with 4 detection methods:
  - `detectLoginAnomalies()` (location, time, device)
  - `detectPermissionEscalation()` (capability grants)
  - `detectDataAccessAnomaly()` (financial exports)
  - `detectSyncAnomalies()` (PEMS sync failures)
- Implement `autoSuspendUser()` for CRITICAL risk
- Implement `notifySecurityTeam()` (Slack webhook)

**Step 3: Background Worker** (1 hour)
- Create `anomalyDetectionWorker.ts`
- Scan all active users every 5 minutes
- Scan all organizations for sync anomalies

**Step 4: API Endpoints** (1 hour)
- `GET /api/security/alerts` (fetch alerts)
- `POST /api/security/alerts/:id/acknowledge` (acknowledge alert)
- Add permission check (only admins can access)

**Step 5: Frontend UI** (2 hours)
- Create `SecurityAlertsPanel` component
- Add real-time polling (30-second interval)
- Add filter (all / unacknowledged)
- Add acknowledgment modal

**Step 6: Testing** (1 hour)
- Simulate login anomaly (login from new country)
- Simulate permission escalation (grant 3+ capabilities in 24 hours)
- Simulate data access anomaly (export 10,000 records at 2am)
- Verify auto-suspend triggers for CRITICAL risk

---

**DELIVERABLES**:

1. **Backend**:
   - `backend/src/services/ai/AnomalyDetectionService.ts` (400+ lines)
   - `backend/src/workers/anomalyDetectionWorker.ts` (100+ lines)
   - `backend/src/controllers/securityController.ts` (100+ lines)
   - `backend/prisma/migrations/*/migration.sql` (SecurityAlert table)

2. **Frontend**:
   - `components/admin/SecurityAlertsPanel.tsx` (200+ lines)

3. **Tests**:
   - `backend/tests/integration/anomalyDetection.test.ts`

4. **Documentation**:
   - `docs/SECURITY_ANOMALY_DETECTION.md`

---

**CONSTRAINTS**:

❌ **DO NOT**:
- Auto-suspend users for LOW/MEDIUM risk (require manual review)
- Send alerts for <80% confidence anomalies (too many false positives)
- Store IP addresses in plaintext (hash for privacy)
- Skip geolocation lookup (needed for location anomalies)

✅ **DO**:
- Auto-suspend for CRITICAL risk (e.g., 10,000 record export at 2am)
- Send Slack alerts to security team immediately
- Log all anomalies (even if not acted upon) for training
- Use AI temperature 0.2 for security consistency
- Provide actionable investigation steps in alerts

---

**VERIFICATION QUESTIONS**:

1. ✅ Are anomalies detected within 5 minutes of occurrence?
2. ✅ Is false positive rate <5% (verify with test data)?
3. ✅ Are users auto-suspended for CRITICAL risk events?
4. ✅ Do alerts include actionable investigation steps?
5. ✅ Is IP geolocation working (city, country detected)?
6. ✅ Are security team notified via Slack immediately?
7. ✅ Can admins acknowledge alerts with resolution notes?
8. ✅ Is alert history accessible for 90 days?

**DEFINITION OF DONE**:
- ✅ Background worker runs every 5 minutes without errors
- ✅ All 4 anomaly types detect correctly (login, permission, data access, sync)
- ✅ Auto-suspend triggers for CRITICAL risk within 1 minute
- ✅ Security team receives Slack alerts <30 seconds after detection
- ✅ False positive rate <5% (verified with 100 test cases)
- ✅ SecurityAlertsPanel shows real-time alerts
- ✅ Tests pass (integration tests for all 4 anomaly types)
- ✅ Documentation complete
```

**Status**: ⬜ Not Started

---

**[CONTINUED IN NEXT MESSAGE DUE TO LENGTH...]**

The prompt bundles are extremely comprehensive. Due to the 200K token budget limitation and the requirement for each bundle to be 600-1500 lines, I'll need to write this to the file in parts. Let me continue with the remaining 3 tasks (6.3, 6.4, 6.5) in the same file.

---

# ADR-005 Agent Workflow - Phase 6 Complete Prompt Bundles (Tasks 6.3-6.5)

**Related**: ADR-005 (Multi-Tenant Access Control)
**Status**: Ready for Execution
**Created**: 2025-11-26

---

## 📋 Overview

This document contains complete, self-contained prompt bundles for the remaining 3 tasks in **Phase 6: AI Foundation (Use Cases 1-5 + Data Hooks)**:

- **Task 6.3**: AI Financial Access Monitoring (ai-security-red-teamer)
- **Task 6.4**: AI Natural Language Permission Queries (ai-systems-architect)
- **Task 6.5**: AI Data Hooks Implementation (backend-architecture-optimizer)

Each bundle is a **copy-paste executable meta-prompt** that contains all context, code, and constraints needed for the assigned agent to execute the task independently.

---

## 🛠️ Task 6.3: AI Financial Access Monitoring

**Agent**: `ai-security-red-teamer`

**Input Dependencies**:
- ✅ Phase 4 complete (audit logging infrastructure)
- ✅ Task 6.2 complete (SecurityAlert table and AnomalyDetectionService exist)

**Output Deliverables**:
- 📄 FinancialAccessMonitor.ts (baseline learning + anomaly detection)
- 📄 API endpoint: GET /api/ai/financial-anomalies
- 📄 Background job: Baseline profiling
- 📄 Integration tests: bypass detection

**Acceptance Criteria**:
- ✅ Learns normal financial access patterns per user
- ✅ Detects unusual financial query attempts
- ✅ Never logs actual cost values (privacy-preserving)
- ✅ Alerts on exfiltration patterns (<1 second detection)

---

### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@ai-security-red-teamer

**SYSTEM CONTEXT**:
You are executing Phase 6, Task 6.3 of ADR-005.
Phase 4 complete (audit logging exists).
Task 6.2 complete (SecurityAlert table and AnomalyDetectionService exist).

**BUSINESS CONTEXT** (from AI_OPPORTUNITIES.md):
Use Case #8: "AI Financial Access Monitoring - Track which users typically access financial data and flag unusual financial data access patterns."

**SECURITY THREAT MODEL**:
Attack Scenarios:
1. **Credential Compromise**: Attacker gains access to Field Engineer account without `viewFinancialDetails` permission, attempts to bypass masking via direct API calls
2. **Insider Threat**: User with `viewFinancialDetails` suddenly exports 10,000+ cost records when baseline is 50/day
3. **Exfiltration**: User iterates through all PFA records, extracting financial data via repeated API calls
4. **Privilege Escalation**: User modifies frontend code to bypass permission checks client-side
5. **Role Abuse**: New admin grants themselves `viewFinancialDetails`, then exports entire financial dataset

**Detection Metrics**:
- **Baseline Learning Window**: 30 days of normal activity
- **Anomaly Threshold**: 2.5 standard deviations from baseline
- **Critical Alert Threshold**: 5x baseline access rate
- **Privacy Requirement**: NEVER log actual cost values, only access patterns

**TECHNICAL SPECIFICATION**:

```typescript
// File: backend/src/services/ai/FinancialAccessMonitor.ts

import { prisma } from '../../config/database';
import { SecurityAlertService } from './SecurityAlertService';

interface FinancialAccessProfile {
  userId: string;
  avgDailyFinancialRecords: number;
  maxDailyFinancialRecords: number;
  avgRecordsPerQuery: number;
  typicalHours: number[]; // Hours of day user typically accesses financial data
  daysWithActivity: number; // Number of days with financial access in last 30 days
  lastUpdated: Date;
}

export class FinancialAccessMonitor {
  /**
   * Step 1: Learn baseline financial access patterns for a user
   * Analyzes audit logs from last 30 days
   *
   * Privacy-Preserving: Only logs access patterns, NEVER actual cost values
   */
  static async learnBaselineProfile(userId: string): Promise<FinancialAccessProfile> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Query audit logs for financial data access
    const financialAccessLogs = await prisma.auditLog.findMany({
      where: {
        userId,
        action: { in: ['pfa:read', 'pfa:export', 'pfa:query'] },
        createdAt: { gte: thirtyDaysAgo },
        metadata: {
          path: { contains: 'includeFinancials=true' } // Only count financial queries
        }
      },
      select: {
        createdAt: true,
        metadata: true, // Contains recordCount, NOT actual costs
      },
      orderBy: { createdAt: 'asc' }
    });

    if (financialAccessLogs.length === 0) {
      // User has never accessed financial data
      return {
        userId,
        avgDailyFinancialRecords: 0,
        maxDailyFinancialRecords: 0,
        avgRecordsPerQuery: 0,
        typicalHours: [],
        daysWithActivity: 0,
        lastUpdated: new Date()
      };
    }

    // Group by day and calculate statistics
    const dailyActivity = new Map<string, number>();
    const hourDistribution = new Map<number, number>();
    const recordCounts: number[] = [];

    for (const log of financialAccessLogs) {
      const day = log.createdAt.toISOString().split('T')[0];
      const hour = log.createdAt.getHours();
      const recordCount = log.metadata?.recordCount || 0;

      // Track daily totals
      dailyActivity.set(day, (dailyActivity.get(day) || 0) + recordCount);

      // Track hour-of-day distribution
      hourDistribution.set(hour, (hourDistribution.get(hour) || 0) + 1);

      // Track record counts per query
      if (recordCount > 0) {
        recordCounts.push(recordCount);
      }
    }

    // Calculate statistics
    const dailyTotals = Array.from(dailyActivity.values());
    const avgDailyRecords = dailyTotals.reduce((sum, val) => sum + val, 0) / dailyTotals.length;
    const maxDailyRecords = Math.max(...dailyTotals);
    const avgRecordsPerQuery = recordCounts.reduce((sum, val) => sum + val, 0) / recordCounts.length;

    // Identify typical access hours (hours with >20% of activity)
    const totalHourlyAccess = Array.from(hourDistribution.values()).reduce((sum, val) => sum + val, 0);
    const threshold = totalHourlyAccess * 0.2;
    const typicalHours = Array.from(hourDistribution.entries())
      .filter(([_, count]) => count >= threshold)
      .map(([hour, _]) => hour);

    return {
      userId,
      avgDailyFinancialRecords: Math.round(avgDailyRecords),
      maxDailyFinancialRecords: maxDailyRecords,
      avgRecordsPerQuery: Math.round(avgRecordsPerQuery),
      typicalHours,
      daysWithActivity: dailyActivity.size,
      lastUpdated: new Date()
    };
  }

  /**
   * Step 2: Detect anomalous financial access in real-time
   * Called by middleware on every financial data query
   */
  static async detectAnomalousAccess(
    userId: string,
    organizationId: string,
    requestMetadata: {
      recordCount: number;
      endpoint: string;
      queryParams: string;
      userAgent: string;
      ipAddress: string;
    }
  ): Promise<{
    isAnomalous: boolean;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reason: string;
    shouldAlert: boolean;
  }> {
    // Get user's baseline profile
    const baseline = await this.learnBaselineProfile(userId);

    const anomalies: string[] = [];
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

    // Check 1: User has no baseline (first financial access ever)
    if (baseline.avgDailyFinancialRecords === 0) {
      anomalies.push('First-time financial data access');
      severity = 'MEDIUM';
    }

    // Check 2: Excessively large query (>5x baseline)
    if (baseline.avgRecordsPerQuery > 0 && requestMetadata.recordCount > baseline.avgRecordsPerQuery * 5) {
      anomalies.push(`Querying ${requestMetadata.recordCount} records (baseline: ${baseline.avgRecordsPerQuery})`);
      severity = 'HIGH';
    }

    // Check 3: Query during unusual hours
    const currentHour = new Date().getHours();
    if (baseline.typicalHours.length > 0 && !baseline.typicalHours.includes(currentHour)) {
      anomalies.push(`Access at ${currentHour}:00 (typical: ${baseline.typicalHours.join(', ')}:00)`);
      severity = severity === 'HIGH' ? 'HIGH' : 'MEDIUM';
    }

    // Check 4: Daily access limit exceeded (get today's count)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayFinancialAccess = await prisma.auditLog.count({
      where: {
        userId,
        action: { in: ['pfa:read', 'pfa:export', 'pfa:query'] },
        createdAt: { gte: todayStart },
        metadata: { path: { contains: 'includeFinancials=true' } }
      }
    });

    if (baseline.avgDailyFinancialRecords > 0 && todayFinancialAccess > baseline.avgDailyFinancialRecords * 3) {
      anomalies.push(`${todayFinancialAccess} financial queries today (baseline: ${baseline.avgDailyFinancialRecords}/day)`);
      severity = 'CRITICAL';
    }

    // Check 5: Suspicious query patterns (API bypass attempt)
    if (requestMetadata.queryParams.includes('includeFinancials=true') &&
        requestMetadata.endpoint !== '/api/pfa/records') {
      anomalies.push('Direct API call with financial flag (possible bypass attempt)');
      severity = 'CRITICAL';
    }

    const isAnomalous = anomalies.length > 0;

    // Log anomaly (privacy-preserving: NO actual cost values)
    if (isAnomalous) {
      await prisma.auditLog.create({
        data: {
          userId,
          organizationId,
          action: 'financial_access.anomaly_detected',
          entityType: 'FinancialData',
          metadata: {
            severity,
            anomalies,
            baseline: {
              avgDailyRecords: baseline.avgDailyFinancialRecords,
              avgRecordsPerQuery: baseline.avgRecordsPerQuery
            },
            request: {
              recordCount: requestMetadata.recordCount,
              endpoint: requestMetadata.endpoint,
              hour: currentHour,
              userAgent: requestMetadata.userAgent,
              ipAddress: requestMetadata.ipAddress
            }
          }
        }
      });
    }

    return {
      isAnomalous,
      severity,
      reason: anomalies.join('; '),
      shouldAlert: severity === 'CRITICAL' || severity === 'HIGH'
    };
  }

  /**
   * Step 3: Create security alert if anomaly detected
   * Integrates with SecurityAlertService from Task 6.2
   */
  static async createFinancialAccessAlert(
    userId: string,
    organizationId: string,
    anomalyResult: Awaited<ReturnType<typeof FinancialAccessMonitor.detectAnomalousAccess>>
  ) {
    if (!anomalyResult.shouldAlert) {
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, role: true }
    });

    await SecurityAlertService.createAlert({
      organizationId,
      userId,
      alertType: 'FINANCIAL_DATA_EXFILTRATION',
      severity: anomalyResult.severity,
      description: `Unusual financial data access detected for ${user?.username} (${user?.role})`,
      details: {
        reason: anomalyResult.reason,
        userRole: user?.role,
        detectionTimestamp: new Date().toISOString()
      },
      actionRequired: anomalyResult.severity === 'CRITICAL' ?
        'Suspend user and investigate immediately' :
        'Review user activity and confirm legitimacy',
      autoResolve: false
    });
  }

  /**
   * Step 4: Background job to update all user baselines daily
   * Run via cron job at 2 AM daily
   */
  static async updateAllBaselines() {
    const activeUsers = await prisma.user.findMany({
      where: { serviceStatus: 'active' },
      select: { id: true }
    });

    console.log(`[FinancialAccessMonitor] Updating baselines for ${activeUsers.length} users`);

    for (const user of activeUsers) {
      try {
        const profile = await this.learnBaselineProfile(user.id);

        // Store profile in database (create UserFinancialProfile table)
        await prisma.userFinancialProfile.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            ...profile
          },
          update: profile
        });
      } catch (error) {
        console.error(`[FinancialAccessMonitor] Failed to update baseline for user ${user.id}:`, error);
      }
    }
  }

  /**
   * Admin API: Get financial access anomalies
   */
  static async getRecentAnomalies(organizationId: string, limit: number = 50) {
    const anomalyLogs = await prisma.auditLog.findMany({
      where: {
        organizationId,
        action: 'financial_access.anomaly_detected'
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return anomalyLogs.map(log => ({
      id: log.id,
      timestamp: log.createdAt,
      user: log.user,
      severity: log.metadata.severity,
      anomalies: log.metadata.anomalies,
      baseline: log.metadata.baseline,
      request: log.metadata.request
    }));
  }
}
```

**Database Migration** (add UserFinancialProfile table):

```prisma
// File: backend/prisma/schema.prisma (add to existing schema)

model UserFinancialProfile {
  id                       String   @id @default(cuid())
  userId                   String   @unique
  avgDailyFinancialRecords Int
  maxDailyFinancialRecords Int
  avgRecordsPerQuery       Int
  typicalHours             String   // JSON array: [9,10,11,14,15,16]
  daysWithActivity         Int
  lastUpdated              DateTime @updatedAt

  user                     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

**API Controller**:

```typescript
// File: backend/src/controllers/financialMonitorController.ts

import { Request, Response } from 'express';
import { FinancialAccessMonitor } from '../services/ai/FinancialAccessMonitor';

/**
 * GET /api/ai/financial-anomalies
 * Get recent financial access anomalies for organization
 *
 * Authorization: perm_ManageUsers (admin only)
 */
export async function getFinancialAnomalies(req: Request, res: Response) {
  const { organizationId } = req.user;
  const limit = parseInt(req.query.limit as string) || 50;

  const anomalies = await FinancialAccessMonitor.getRecentAnomalies(organizationId, limit);

  res.json({
    anomalies,
    totalCount: anomalies.length
  });
}

/**
 * GET /api/ai/financial-baseline/:userId
 * Get financial access baseline for specific user
 *
 * Authorization: perm_ManageUsers
 */
export async function getUserFinancialBaseline(req: Request, res: Response) {
  const { userId } = req.params;

  const baseline = await FinancialAccessMonitor.learnBaselineProfile(userId);

  res.json(baseline);
}
```

**Middleware Integration** (detect on every financial query):

```typescript
// File: backend/src/middleware/financialAccessMonitoring.ts

import { Request, Response, NextFunction } from 'express';
import { FinancialAccessMonitor } from '../services/ai/FinancialAccessMonitor';

export async function monitorFinancialAccess(req: Request, res: Response, next: NextFunction) {
  const userId = req.user.id;
  const organizationId = req.user.organizationId;

  // Only monitor if query includes financial data
  if (req.query.includeFinancials === 'true' || req.body.includeFinancials === true) {

    // Detect anomaly (non-blocking)
    setImmediate(async () => {
      try {
        const anomaly = await FinancialAccessMonitor.detectAnomalousAccess(
          userId,
          organizationId,
          {
            recordCount: parseInt(req.query.limit as string) || 100,
            endpoint: req.path,
            queryParams: JSON.stringify(req.query),
            userAgent: req.headers['user-agent'] || 'unknown',
            ipAddress: req.ip
          }
        );

        if (anomaly.shouldAlert) {
          await FinancialAccessMonitor.createFinancialAccessAlert(userId, organizationId, anomaly);
        }
      } catch (error) {
        console.error('[FinancialAccessMonitoring] Error detecting anomaly:', error);
      }
    });
  }

  next(); // Don't block request
}
```

**AI ENFORCEMENT**:
🚨 **MANDATORY**: NEVER log actual cost values, only access patterns (recordCount, time, frequency).
🚨 **MANDATORY**: Detect anomalies in <1 second (non-blocking background process).
🚨 **MANDATORY**: Create CRITICAL alerts for exfiltration attempts (5x baseline).

**UX ENFORCEMENT** (from UX_SPEC.md):
🚨 **MANDATORY**: Admin dashboard shows real-time financial anomalies.
🚨 **MANDATORY**: Alerts include actionable recommendations ("Suspend user", "Review activity").
🚨 **MANDATORY**: Baseline profiles visible to admins (transparency).

**YOUR MISSION**:

**Step 1**: Create FinancialAccessMonitor.ts with 4 core methods (baseline learning, anomaly detection, alert creation, background job)
**Step 2**: Add UserFinancialProfile table to Prisma schema
**Step 3**: Create API endpoints (GET /financial-anomalies, GET /financial-baseline/:userId)
**Step 4**: Integrate monitoring middleware into PFA read routes
**Step 5**: Write integration tests for bypass detection

**DELIVERABLES**:
1. backend/src/services/ai/FinancialAccessMonitor.ts (300+ lines)
2. backend/prisma/schema.prisma (UserFinancialProfile model)
3. backend/src/controllers/financialMonitorController.ts
4. backend/src/middleware/financialAccessMonitoring.ts
5. backend/tests/integration/financialAccessMonitoring.test.ts

**CONSTRAINTS**:
- ❌ Do NOT log actual cost values (PII violation)
- ❌ Do NOT block requests for anomaly detection (must be async)
- ❌ Do NOT alert on false positives (require >80% confidence)
- ✅ DO learn baselines over 30-day window
- ✅ DO detect exfiltration patterns (5x baseline = CRITICAL)
- ✅ DO integrate with SecurityAlert system from Task 6.2

**VERIFICATION QUESTIONS**:
1. Are actual cost values NEVER logged in audit or alert systems?
2. Does anomaly detection complete in <1 second without blocking requests?
3. Are CRITICAL alerts immediately visible in admin dashboard?
4. Can admins view user baselines to understand alert context?
5. Does baseline learning account for infrequent users (0 access = valid baseline)?
```

---

## 🛠️ Task 6.4: AI Natural Language Permission Queries

**Agent**: `ai-systems-architect`

**Input Dependencies**:
- ✅ Phase 1 complete (User/Organization/Permission tables exist)
- ✅ AI provider configured (Gemini/OpenAI/Claude)

**Output Deliverables**:
- 📄 NLQueryParser.ts (LLM-powered query parsing)
- 📄 SemanticPermissionSearch.ts (semantic matching)
- 📄 API endpoint: POST /api/ai/permission-query
- 📄 Frontend component: NLQueryInput.tsx

**Acceptance Criteria**:
- ✅ Parses "Show me all users who can manage settings in HOLNG"
- ✅ Handles variations ("manage settings" = perm_ManageSettings)
- ✅ Returns user-friendly results with role explanations
- ✅ Query response time <2 seconds

---

### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@ai-systems-architect

**SYSTEM CONTEXT**:
You are executing Phase 6, Task 6.4 of ADR-005.
Phase 1 complete (User/Organization/Permission tables exist).
AI provider configured (Gemini API available).

**BUSINESS CONTEXT** (from AI_OPPORTUNITIES.md):
Use Case #5: "AI Natural Language Permission Queries - Admins can ask questions like 'Show me all users who can manage settings in HOLNG' and get natural language results."

**USER SCENARIOS**:
1. Admin: "Which users have access to the PEMS sync feature?"
   - Expected: List of users with perm_SyncPems capability
2. Admin: "Show me everyone who can view financial data in Rio Tinto"
   - Expected: List of users in RIO org with viewFinancialDetails=true
3. Admin: "Who has admin access to all organizations?"
   - Expected: Users with isGlobalAdmin=true
4. Admin: "List editors in HOLNG who can also delete records"
   - Expected: Users with role=Editor AND canDelete=true in HOLNG

**SEMANTIC MATCHING REQUIREMENTS**:
- "manage settings" → perm_ManageSettings
- "sync" → perm_SyncPems
- "view costs" → viewFinancialDetails
- "delete" → canDelete
- "write" / "edit" → canWrite
- "admin" → role=Admin OR isGlobalAdmin
- "HOLNG" / "Holcim" → organizationId lookup by code/name

**TECHNICAL SPECIFICATION**:

```typescript
// File: backend/src/services/ai/NLQueryParser.ts

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../../config/database';

interface ParsedPermissionQuery {
  queryType: 'list_users' | 'check_access' | 'count_users';
  filters: {
    organizationId?: string;
    organizationCode?: string;
    role?: string;
    permissions?: string[]; // e.g., ['perm_ManageSettings', 'canDelete']
    isGlobalAdmin?: boolean;
  };
  naturalLanguageResponse: string;
  confidence: number; // 0-1
}

export class NLQueryParser {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
  }

  /**
   * Step 1: Parse natural language query into structured filters
   */
  async parseQuery(userQuery: string, organizationContext?: string): Promise<ParsedPermissionQuery> {
    const prompt = `
You are a permission query parser for a multi-tenant construction management system.

**PERMISSION CAPABILITIES** (database fields):
- perm_ManageUsers: Can create/edit/delete users
- perm_ManageSettings: Can configure organization settings
- perm_SyncPems: Can trigger PEMS data synchronization
- perm_ManageApiServers: Can configure API servers
- canRead: Can view PFA records
- canWrite: Can edit PFA records
- canDelete: Can delete PFA records
- canExport: Can export PFA records
- viewFinancialDetails: Can see actual cost values
- isGlobalAdmin: Has access to all organizations

**ORGANIZATIONS** (example):
- HOLNG: Holcim Nigeria
- RIO: Rio Tinto
- BECH: Bechtel
- PEMS_Global: PEMS Global

**USER QUERY**: "${userQuery}"

Parse this query into a JSON object with these fields:
{
  "queryType": "list_users" | "check_access" | "count_users",
  "filters": {
    "organizationCode": "HOLNG" (if organization mentioned),
    "role": "Admin" (if role mentioned: Admin, Editor, Viewer, Field Engineer),
    "permissions": ["perm_ManageSettings"] (array of capabilities mentioned),
    "isGlobalAdmin": true (if "global admin" mentioned)
  },
  "confidence": 0.95 (0-1, how confident you are in this parsing)
}

**SEMANTIC MAPPING**:
- "manage settings" → perm_ManageSettings
- "sync" / "PEMS sync" → perm_SyncPems
- "view costs" / "financial data" → viewFinancialDetails
- "delete" → canDelete
- "edit" / "write" → canWrite
- "admin" → role=Admin (unless "global admin" → isGlobalAdmin=true)

Return ONLY the JSON object, no markdown formatting.
`;

    const result = await this.model.generateContent(prompt);
    const response = result.response.text();

    // Clean response (remove markdown code blocks if present)
    const cleanedResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleanedResponse);
    } catch (error) {
      throw new Error(`Failed to parse LLM response: ${cleanedResponse}`);
    }

    // Validate confidence
    if (parsed.confidence < 0.7) {
      throw new Error(`Low confidence (${parsed.confidence}) in query parsing. Please rephrase your question.`);
    }

    return {
      queryType: parsed.queryType || 'list_users',
      filters: parsed.filters || {},
      naturalLanguageResponse: '', // Will be generated in Step 3
      confidence: parsed.confidence
    };
  }

  /**
   * Step 2: Execute database query based on parsed filters
   */
  async executeQuery(parsedQuery: ParsedPermissionQuery): Promise<any[]> {
    const { filters } = parsedQuery;

    // Build Prisma where clause
    const whereClause: any = {
      serviceStatus: 'active'
    };

    // Filter by organization
    if (filters.organizationCode) {
      const org = await prisma.organization.findFirst({
        where: { code: filters.organizationCode },
        select: { id: true }
      });

      if (!org) {
        throw new Error(`Organization ${filters.organizationCode} not found`);
      }

      whereClause.organizations = {
        some: {
          organizationId: org.id,
          isActive: true
        }
      };
    }

    // Filter by role
    if (filters.role) {
      whereClause.role = filters.role;
    }

    // Filter by global admin
    if (filters.isGlobalAdmin === true) {
      whereClause.isGlobalAdmin = true;
    }

    // Execute query
    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isGlobalAdmin: true,
        organizations: {
          where: filters.organizationCode ? {
            organization: { code: filters.organizationCode }
          } : {},
          select: {
            organization: {
              select: {
                code: true,
                name: true
              }
            },
            perm_ManageUsers: true,
            perm_ManageSettings: true,
            perm_SyncPems: true,
            perm_ManageApiServers: true,
            canRead: true,
            canWrite: true,
            canDelete: true,
            canExport: true,
            viewFinancialDetails: true
          }
        }
      }
    });

    // Filter by specific permissions (post-query filter)
    if (filters.permissions && filters.permissions.length > 0) {
      return users.filter(user => {
        // Check if user has ALL specified permissions
        return filters.permissions!.every(perm => {
          if (user.isGlobalAdmin) return true; // Global admins have all permissions

          return user.organizations.some(org => {
            const userOrg = org as any;
            return userOrg[perm] === true;
          });
        });
      });
    }

    return users;
  }

  /**
   * Step 3: Generate natural language response
   */
  async generateNaturalLanguageResponse(
    userQuery: string,
    parsedQuery: ParsedPermissionQuery,
    results: any[]
  ): Promise<string> {
    if (results.length === 0) {
      return `No users found matching your query "${userQuery}".`;
    }

    const prompt = `
Generate a concise natural language summary for this permission query result.

**USER QUERY**: "${userQuery}"

**RESULTS**: ${results.length} users found
${results.slice(0, 5).map(u => `- ${u.username} (${u.role})`).join('\n')}
${results.length > 5 ? `\n... and ${results.length - 5} more` : ''}

Generate a 1-2 sentence summary like:
"Found 12 users with permission to manage settings in HOLNG, including 3 Admins and 9 Field Engineers."

Return ONLY the summary text, no additional commentary.
`;

    const result = await this.model.generateContent(prompt);
    return result.response.text().trim();
  }

  /**
   * Main entry point: Query + Execute + Format
   */
  async processNaturalLanguageQuery(userQuery: string, organizationContext?: string) {
    // Step 1: Parse
    const parsedQuery = await this.parseQuery(userQuery, organizationContext);

    // Step 2: Execute
    const results = await this.executeQuery(parsedQuery);

    // Step 3: Generate NL response
    const nlResponse = await this.generateNaturalLanguageResponse(userQuery, parsedQuery, results);

    return {
      query: userQuery,
      parsedFilters: parsedQuery.filters,
      confidence: parsedQuery.confidence,
      resultCount: results.length,
      naturalLanguageResponse: nlResponse,
      results: results.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isGlobalAdmin: user.isGlobalAdmin,
        organizations: user.organizations.map((org: any) => ({
          code: org.organization.code,
          name: org.organization.name,
          permissions: {
            perm_ManageUsers: org.perm_ManageUsers,
            perm_ManageSettings: org.perm_ManageSettings,
            perm_SyncPems: org.perm_SyncPems,
            perm_ManageApiServers: org.perm_ManageApiServers,
            canRead: org.canRead,
            canWrite: org.canWrite,
            canDelete: org.canDelete,
            canExport: org.canExport,
            viewFinancialDetails: org.viewFinancialDetails
          }
        }))
      }))
    };
  }
}
```

**API Controller**:

```typescript
// File: backend/src/controllers/nlPermissionQueryController.ts

import { Request, Response } from 'express';
import { NLQueryParser } from '../services/ai/NLQueryParser';

/**
 * POST /api/ai/permission-query
 * Process natural language permission query
 *
 * Authorization: perm_ManageUsers (admin only)
 *
 * Body:
 * {
 *   "query": "Show me all users who can manage settings in HOLNG"
 * }
 */
export async function processPermissionQuery(req: Request, res: Response) {
  const { query } = req.body;
  const organizationContext = req.user.organizationId;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({
      error: 'Query cannot be empty'
    });
  }

  try {
    const parser = new NLQueryParser();
    const result = await parser.processNaturalLanguageQuery(query, organizationContext);

    res.json(result);
  } catch (error: any) {
    if (error.message.includes('Low confidence')) {
      return res.status(400).json({
        error: error.message,
        suggestion: 'Try rephrasing your question to be more specific, e.g. "Show me users with PEMS sync permission in HOLNG"'
      });
    }

    throw error;
  }
}
```

**Frontend Component**:

```tsx
// File: components/admin/NLQueryInput.tsx

import React, { useState } from 'react';
import { Input, Button, Card, Spinner } from '@nextui-org/react';
import { Search } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface QueryResult {
  query: string;
  naturalLanguageResponse: string;
  resultCount: number;
  confidence: number;
  results: Array<{
    id: string;
    username: string;
    email: string;
    role: string;
    organizations: Array<{
      code: string;
      name: string;
      permissions: Record<string, boolean>;
    }>;
  }>;
}

export function NLQueryInput() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/api/ai/permission-query', { query });
      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to process query');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="text"
          placeholder="e.g. Show me all users who can manage settings in HOLNG"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
          startContent={<Search className="w-4 h-4 text-gray-400" />}
        />
        <Button type="submit" color="primary" isLoading={loading}>
          Search
        </Button>
      </form>

      {error && (
        <Card className="p-4 bg-red-50 border border-red-200">
          <p className="text-red-700">{error}</p>
        </Card>
      )}

      {result && (
        <Card className="p-6">
          <div className="space-y-4">
            {/* Natural Language Summary */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-blue-900 font-medium">{result.naturalLanguageResponse}</p>
              <p className="text-sm text-blue-700 mt-1">
                Found {result.resultCount} {result.resultCount === 1 ? 'user' : 'users'}
                (Confidence: {Math.round(result.confidence * 100)}%)
              </p>
            </div>

            {/* Results Table */}
            {result.results.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Username</th>
                      <th className="text-left p-2">Role</th>
                      <th className="text-left p-2">Organizations</th>
                      <th className="text-left p-2">Permissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map(user => (
                      <tr key={user.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{user.username}</td>
                        <td className="p-2">{user.role}</td>
                        <td className="p-2">
                          {user.organizations.map(org => org.code).join(', ')}
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1 flex-wrap">
                            {Object.entries(user.organizations[0]?.permissions || {})
                              .filter(([_, value]) => value === true)
                              .map(([key, _]) => (
                                <span
                                  key={key}
                                  className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded"
                                >
                                  {key.replace('perm_', '').replace(/([A-Z])/g, ' $1').trim()}
                                </span>
                              ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
```

**AI ENFORCEMENT**:
🚨 **MANDATORY**: Use LLM for query parsing (semantic understanding).
🚨 **MANDATORY**: Require >70% confidence score, else reject query.
🚨 **MANDATORY**: Generate natural language response for results.

**UX ENFORCEMENT** (from UX_SPEC.md):
🚨 **MANDATORY**: Search input prominent in Admin Dashboard.
🚨 **MANDATORY**: Show confidence score to admins (transparency).
🚨 **MANDATORY**: Results displayed in <2 seconds.

**YOUR MISSION**:

**Step 1**: Create NLQueryParser.ts with 4 methods (parse, execute, generate NL response, process)
**Step 2**: Integrate Gemini API for semantic query parsing
**Step 3**: Create API endpoint POST /api/ai/permission-query
**Step 4**: Build React component NLQueryInput.tsx with auto-complete
**Step 5**: Write integration tests for query variations

**DELIVERABLES**:
1. backend/src/services/ai/NLQueryParser.ts (250+ lines)
2. backend/src/controllers/nlPermissionQueryController.ts
3. components/admin/NLQueryInput.tsx
4. backend/tests/integration/nlPermissionQuery.test.ts
5. Documentation: Natural language query examples

**CONSTRAINTS**:
- ❌ Do NOT parse queries client-side (security risk)
- ❌ Do NOT expose raw SQL in responses
- ❌ Do NOT allow queries across organizations (respect multi-tenancy)
- ✅ DO require >70% LLM confidence score
- ✅ DO handle semantic variations ("manage settings" = perm_ManageSettings)
- ✅ DO return user-friendly results with role explanations

**VERIFICATION QUESTIONS**:
1. Does parser handle variations ("manage settings", "configure org", "change settings")?
2. Is LLM confidence score displayed to admins?
3. Are results returned in <2 seconds for 1000+ users?
4. Does component integrate into Admin Dashboard seamlessly?
5. Are low-confidence queries rejected with helpful suggestions?
```

---

## 🛠️ Task 6.5: AI Data Hooks Implementation

**Agent**: `backend-architecture-optimizer`

**Input Dependencies**:
- ✅ Phase 2 complete (AuditLog table exists)
- ✅ Phase 4 complete (all CRUD operations have audit logging)

**Output Deliverables**:
- 📄 Enhanced AuditLog with AI-ready metadata
- 📄 External ID tracking (PEMS entities)
- 📄 Background data collection hooks
- 📄 Privacy-compliant logging service

**Acceptance Criteria**:
- ✅ All permission changes logged with before/after state
- ✅ External IDs tracked for PEMS users/organizations
- ✅ Metadata captured for AI training (no PII)
- ✅ Background hooks don't impact performance (<10ms overhead)

---

### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@backend-architecture-optimizer

**SYSTEM CONTEXT**:
You are executing Phase 6, Task 6.5 of ADR-005.
Phase 2 complete (AuditLog table exists).
Phase 4 complete (all CRUD operations have audit logging).

**BUSINESS CONTEXT** (from AI_OPPORTUNITIES.md):
"AI Data Hooks - All AI use cases (1-25) require foundational data collection infrastructure. This task implements the data prerequisites for future AI training."

**DATA REQUIREMENTS FOR AI USE CASES**:

1. **Permission Suggestions (UC #1)**: Historical permission grant/revoke decisions
2. **Anomaly Detection (UC #2)**: Baseline user activity patterns
3. **Financial Monitoring (UC #8)**: Financial access frequency (NOT actual costs)
4. **Audit Search (UC #18)**: Semantic event metadata (who/what/when/why)
5. **Role Drift Detection (UC #19)**: Permission overrides and role changes over time

**PRIVACY CONSTRAINTS**:
- ❌ **NEVER** log: Passwords, API keys, actual cost values, personally identifiable information (PII)
- ✅ **ALWAYS** log: User IDs (not names), action types, timestamps, before/after states (for rollback)

**TECHNICAL SPECIFICATION**:

```typescript
// File: backend/src/services/aiDataHooks/DataCollectionService.ts

import { prisma } from '../../config/database';
import { AuditLog, Prisma } from '@prisma/client';

/**
 * AI-Ready Audit Logging Service
 *
 * Purpose: Capture metadata for AI training without logging PII
 *
 * Privacy Principles:
 * 1. Log user IDs, NOT usernames/emails (anonymization)
 * 2. Log action types, NOT actual values (e.g., "cost updated" NOT "$50000")
 * 3. Log timestamps for pattern analysis
 * 4. Log before/after states for rollback capability
 */
export class DataCollectionService {
  /**
   * Enhanced audit log with AI-ready metadata
   *
   * Metadata Structure:
   * {
   *   actionType: 'permission:grant' | 'permission:revoke' | 'user:created' | 'org:created',
   *   entityType: 'User' | 'Organization' | 'UserOrganization' | 'ApiServer',
   *   entityId: 'uuid',
   *   externalId: 'PEMS-10345' (if entity is from external system),
   *   beforeState: { ... } (for rollback),
   *   afterState: { ... } (current state),
   *   context: {
   *     ipAddress: '10.0.0.1',
   *     userAgent: 'Mozilla/5.0...',
   *     sessionId: 'uuid',
   *     organizationContext: 'HOLNG'
   *   },
   *   aiMetadata: {
   *     isAnomalous: false,
   *     confidence: 0.95,
   *     relatedEvents: ['audit-log-id-1', 'audit-log-id-2']
   *   }
   * }
   */
  static async logPermissionChange(data: {
    userId: string;
    actorUserId: string; // Who made the change
    organizationId: string;
    action: 'grant' | 'revoke';
    permissionField: string; // e.g., 'perm_ManageSettings'
    permissionValue: boolean;
    beforeState: any;
    afterState: any;
    context?: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
    };
  }): Promise<AuditLog> {
    return await prisma.auditLog.create({
      data: {
        userId: data.actorUserId,
        organizationId: data.organizationId,
        action: `permission:${data.action}`,
        entityType: 'UserOrganization',
        entityId: data.userId,
        metadata: {
          permissionField: data.permissionField,
          permissionValue: data.permissionValue,
          beforeState: this.sanitizeState(data.beforeState), // Remove PII
          afterState: this.sanitizeState(data.afterState),
          context: data.context || {},
          aiMetadata: {
            isPermissionChange: true,
            affectedUser: data.userId,
            changedBy: data.actorUserId
          }
        }
      }
    });
  }

  /**
   * Log external entity creation/update (PEMS users, orgs)
   * Tracks external ID for data lineage
   */
  static async logExternalEntitySync(data: {
    userId: string;
    organizationId: string;
    action: 'created' | 'updated' | 'synced';
    entityType: 'User' | 'Organization' | 'PfaRecord';
    entityId: string;
    externalId: string; // PEMS ID
    externalSystem: 'PEMS' | 'ESS' | 'Procurement';
    syncMetadata: {
      recordsProcessed: number;
      recordsInserted: number;
      recordsUpdated: number;
      recordsSkipped: number;
    };
  }): Promise<AuditLog> {
    return await prisma.auditLog.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        action: `${data.entityType.toLowerCase()}:${data.action}`,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: {
          externalId: data.externalId,
          externalSystem: data.externalSystem,
          syncMetadata: data.syncMetadata,
          aiMetadata: {
            isExternalSync: true,
            dataSource: data.externalSystem
          }
        }
      }
    });
  }

  /**
   * Log user action patterns (for anomaly detection baseline)
   * Privacy-preserving: Only logs action type and timestamp
   */
  static async logUserActivity(data: {
    userId: string;
    organizationId: string;
    actionType: string; // 'pfa:read', 'pfa:write', 'user:login', etc.
    resourceType?: string;
    recordCount?: number; // Number of records accessed
    context?: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
    };
  }): Promise<AuditLog> {
    return await prisma.auditLog.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        action: data.actionType,
        entityType: data.resourceType || 'Activity',
        metadata: {
          recordCount: data.recordCount,
          context: data.context || {},
          aiMetadata: {
            isUserActivity: true,
            timestamp: new Date().toISOString(),
            hour: new Date().getHours() // For time-of-day pattern analysis
          }
        }
      }
    });
  }

  /**
   * Log bulk operations (for anomaly detection)
   * Tracks operation size for exfiltration detection
   */
  static async logBulkOperation(data: {
    userId: string;
    organizationId: string;
    operation: 'update' | 'delete' | 'export';
    entityType: string;
    recordCount: number;
    affectedFields?: string[]; // Which fields were modified
  }): Promise<AuditLog> {
    return await prisma.auditLog.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        action: `bulk:${data.operation}`,
        entityType: data.entityType,
        metadata: {
          recordCount: data.recordCount,
          affectedFields: data.affectedFields || [],
          aiMetadata: {
            isBulkOperation: true,
            operationSize: data.recordCount,
            timestamp: new Date().toISOString()
          }
        }
      }
    });
  }

  /**
   * Privacy-compliant state sanitization
   * Removes PII before logging
   */
  private static sanitizeState(state: any): any {
    if (!state) return null;

    const sanitized = { ...state };

    // Remove sensitive fields
    const piiFields = ['password', 'passwordHash', 'email', 'phone', 'apiKey', 'credentials'];
    for (const field of piiFields) {
      if (sanitized[field]) {
        delete sanitized[field];
      }
    }

    // Mask actual cost values (keep only metadata)
    if (sanitized.cost || sanitized.monthlyRate || sanitized.purchasePrice) {
      sanitized.hasCostData = true;
      delete sanitized.cost;
      delete sanitized.monthlyRate;
      delete sanitized.purchasePrice;
    }

    return sanitized;
  }

  /**
   * Query audit logs for AI training
   * Returns aggregated statistics, NOT raw logs
   */
  static async getAITrainingData(organizationId: string, options?: {
    startDate?: Date;
    endDate?: Date;
    actionTypes?: string[];
    limit?: number;
  }) {
    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      createdAt: {
        gte: options?.startDate,
        lte: options?.endDate
      }
    };

    if (options?.actionTypes) {
      where.action = { in: options.actionTypes };
    }

    const logs = await prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        userId: true, // ID only, not username
        action: true,
        entityType: true,
        createdAt: true,
        metadata: true
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 10000
    });

    // Aggregate statistics (privacy-preserving)
    return {
      totalEvents: logs.length,
      actionDistribution: this.aggregateActions(logs),
      hourlyDistribution: this.aggregateByHour(logs),
      userActivitySummary: this.aggregateByUser(logs),
      bulkOperations: logs.filter(log => log.action.startsWith('bulk:')).length,
      permissionChanges: logs.filter(log => log.action.startsWith('permission:')).length
    };
  }

  private static aggregateActions(logs: any[]) {
    const distribution: Record<string, number> = {};
    for (const log of logs) {
      distribution[log.action] = (distribution[log.action] || 0) + 1;
    }
    return distribution;
  }

  private static aggregateByHour(logs: any[]) {
    const hourDistribution: Record<number, number> = {};
    for (const log of logs) {
      const hour = new Date(log.createdAt).getHours();
      hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
    }
    return hourDistribution;
  }

  private static aggregateByUser(logs: any[]) {
    const userActivity: Record<string, { actions: number; lastSeen: Date }> = {};
    for (const log of logs) {
      if (!userActivity[log.userId]) {
        userActivity[log.userId] = { actions: 0, lastSeen: log.createdAt };
      }
      userActivity[log.userId].actions += 1;
      if (log.createdAt > userActivity[log.userId].lastSeen) {
        userActivity[log.userId].lastSeen = log.createdAt;
      }
    }
    return userActivity;
  }
}
```

**Enhanced AuditLog Middleware** (auto-inject context):

```typescript
// File: backend/src/middleware/auditContext.ts

import { Request, Response, NextFunction } from 'express';

/**
 * Injects audit context into request
 * Captures IP, User-Agent, Session ID for AI analysis
 */
export function injectAuditContext(req: Request, res: Response, next: NextFunction) {
  req.auditContext = {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || 'unknown',
    sessionId: req.headers['x-session-id'] as string || undefined,
    organizationContext: req.user?.organizationId
  };

  next();
}

// Type declaration
declare global {
  namespace Express {
    interface Request {
      auditContext?: {
        ipAddress: string;
        userAgent: string;
        sessionId?: string;
        organizationContext?: string;
      };
    }
  }
}
```

**Integration Example** (User Permission Grant):

```typescript
// File: backend/src/controllers/userController.ts (existing file)

import { DataCollectionService } from '../services/aiDataHooks/DataCollectionService';

// BEFORE (existing code):
router.patch('/users/:userId/permissions', requireAuth, async (req, res) => {
  const { userId } = req.params;
  const { organizationId, perm_ManageSettings, canDelete, viewFinancialDetails } = req.body;

  const beforeState = await prisma.userOrganization.findFirst({
    where: { userId, organizationId }
  });

  await prisma.userOrganization.update({
    where: { userId_organizationId: { userId, organizationId } },
    data: { perm_ManageSettings, canDelete, viewFinancialDetails }
  });

  res.json({ success: true });
});

// AFTER (with AI data hooks):
router.patch('/users/:userId/permissions', requireAuth, async (req, res) => {
  const { userId } = req.params;
  const { organizationId, perm_ManageSettings, canDelete, viewFinancialDetails } = req.body;

  const beforeState = await prisma.userOrganization.findFirst({
    where: { userId, organizationId }
  });

  const updatedUserOrg = await prisma.userOrganization.update({
    where: { userId_organizationId: { userId, organizationId } },
    data: { perm_ManageSettings, canDelete, viewFinancialDetails }
  });

  // 🎯 AI DATA HOOK: Log permission changes
  const changedFields = [];
  if (perm_ManageSettings !== undefined) changedFields.push('perm_ManageSettings');
  if (canDelete !== undefined) changedFields.push('canDelete');
  if (viewFinancialDetails !== undefined) changedFields.push('viewFinancialDetails');

  for (const field of changedFields) {
    await DataCollectionService.logPermissionChange({
      userId,
      actorUserId: req.user.id,
      organizationId,
      action: updatedUserOrg[field] === true ? 'grant' : 'revoke',
      permissionField: field,
      permissionValue: updatedUserOrg[field],
      beforeState,
      afterState: updatedUserOrg,
      context: req.auditContext
    });
  }

  res.json({ success: true });
});
```

**External ID Tracking** (Prisma Schema Enhancement):

```prisma
// File: backend/prisma/schema.prisma (add to existing models)

model User {
  // ... existing fields ...

  // External System Tracking
  externalId       String?  // PEMS user ID (e.g., "PEMS-10345")
  externalSource   String?  // "PEMS", "ESS", "AD"
  lastSyncedAt     DateTime? // When last synced from external system

  @@index([externalId, externalSource]) // Fast lookup by external ID
}

model Organization {
  // ... existing fields ...

  // External System Tracking
  externalId       String?  // PEMS org ID
  externalSource   String?  // "PEMS"
  lastSyncedAt     DateTime?

  @@index([externalId, externalSource])
}

model PfaRecord {
  // ... existing fields ...

  // External System Tracking
  externalId       String?  // PEMS PFA record ID
  externalSource   String?  // "PEMS", "ESS"
  lastSyncedAt     DateTime?

  @@index([externalId, externalSource])
}
```

**AI ENFORCEMENT**:
🚨 **MANDATORY**: NEVER log passwords, API keys, actual costs, or PII.
🚨 **MANDATORY**: Sanitize before/after states before logging.
🚨 **MANDATORY**: Track external IDs for data lineage.

**UX ENFORCEMENT**:
🚨 **MANDATORY**: Audit hooks add <10ms overhead (non-blocking).
🚨 **MANDATORY**: Background data collection doesn't impact user experience.

**YOUR MISSION**:

**Step 1**: Create DataCollectionService.ts with 5 core logging methods
**Step 2**: Add auditContext middleware to inject IP/User-Agent
**Step 3**: Enhance Prisma schema with externalId fields
**Step 4**: Integrate data hooks into ALL permission grant/revoke operations
**Step 5**: Create privacy-compliant aggregation queries for AI training

**DELIVERABLES**:
1. backend/src/services/aiDataHooks/DataCollectionService.ts (400+ lines)
2. backend/src/middleware/auditContext.ts
3. backend/prisma/schema.prisma (external ID fields)
4. Integration into userController.ts, organizationController.ts, pemsSyncController.ts
5. Documentation: AI data collection privacy policy

**CONSTRAINTS**:
- ❌ Do NOT log actual cost values (only "hasCostData" flag)
- ❌ Do NOT log usernames/emails (only user IDs)
- ❌ Do NOT log API keys or credentials
- ✅ DO log before/after states for rollback capability
- ✅ DO track external IDs for PEMS entities
- ✅ DO add <10ms overhead per operation

**VERIFICATION QUESTIONS**:
1. Are ALL permission changes logged with before/after state?
2. Is PII (emails, usernames, costs) NEVER logged?
3. Are external IDs tracked for PEMS users/organizations?
4. Does audit logging add <10ms overhead (measured via benchmarks)?
5. Can AI query aggregated statistics without accessing raw logs?
```

---

## 📊 Phase 6 Summary

**Total Tasks**: 5 (6.1, 6.2, 6.3, 6.4, 6.5)

**Completion Status**:
- ✅ Task 6.1: AI Permission Suggestions (complete prompt in AGENT_WORKFLOW-PHASES-6-10.md)
- ✅ Task 6.2: AI Security Anomaly Detection (complete prompt in AGENT_WORKFLOW-PHASES-6-10.md)
- ✅ Task 6.3: AI Financial Access Monitoring (complete prompt above)
- ✅ Task 6.4: AI Natural Language Permission Queries (complete prompt above)
- ✅ Task 6.5: AI Data Hooks Implementation (complete prompt above)

**Phase 6 Deliverables**:
1. PermissionSuggestionEngine.ts (300+ lines)
2. AnomalyDetectionService.ts (450+ lines)
3. FinancialAccessMonitor.ts (350+ lines)
4. NLQueryParser.ts (250+ lines)
5. DataCollectionService.ts (400+ lines)
6. Frontend: SuggestedPermissions.tsx, SecurityAlertWidget.tsx, NLQueryInput.tsx
7. Database: SecurityAlert, UserFinancialProfile tables + external ID fields
8. Integration tests: 25+ test cases

**Total Lines of Code**: ~2,500 lines across 8 files

**Next Phase**: Phase 7 - UX Intelligence (AI Use Cases 16-20)

---

## 📚 Related Documentation

- **Decision**: [ADR-005-DECISION.md](./ADR-005-DECISION.md)
- **AI Opportunities**: [ADR-005-AI_OPPORTUNITIES.md](./ADR-005-AI_OPPORTUNITIES.md)
- **UX Specification**: [ADR-005-UX_SPEC.md](./ADR-005-UX_SPEC.md)
- **Implementation Plan**: [ADR-005-IMPLEMENTATION_PLAN.md](./ADR-005-IMPLEMENTATION_PLAN.md)
- **Test Plan**: [ADR-005-TEST_PLAN.md](./ADR-005-TEST_PLAN.md)
- **Main Workflow**: [ADR-005-AGENT_WORKFLOW-PHASES-6-10.md](./ADR-005-AGENT_WORKFLOW-PHASES-6-10.md)

---

**Document Statistics**:
- **Prompt Bundles**: 3 complete meta-prompts (6.3, 6.4, 6.5)
- **Total Specification Lines**: ~1,800 lines of complete code specifications
- **Copy-Paste Ready**: ✅ All bundles are self-contained and executable
- **AI Use Cases Covered**: UC #5 (NL Queries), UC #8 (Financial Monitoring), Data Hooks (foundation for UC #1-25)

*Document created: 2025-11-26*
*Status: Complete - Ready for Agent Execution*

---

## 🎨 Phase 7: UX Intelligence

**Duration**: 3 days | **Prerequisites**: Phase 6 Complete

---

# Phase 7, Task 7.1: Context-Aware Access Explanation (AI Use Case 16)

**Agent**: @ux-technologist
**Estimated Duration**: 2 days
**Phase**: 7 (UX Intelligence)
**Dependencies**: Phase 4 Complete (Frontend Permission Enforcement)
**Status**: Ready to Execute

---

## SYSTEM CONTEXT

You are implementing **Use Case 16: Context-Aware Access Explanation** from ADR-005, a sophisticated AI-powered tooltip system that transforms user frustration ("Why can't I do this?") into actionable guidance.

**The Problem**: Users encounter disabled buttons and locked features but receive no explanation. They must contact admins, who then manually investigate the permission chain to explain the restriction. This wastes 10-30 minutes per incident and creates support burden.

**The Solution**: AI-powered tooltips that instantly explain WHY a user is denied access and HOW to resolve it, using chain-of-thought reasoning to analyze the permission chain and generate human-readable explanations.

**Business Value**:
- **30% reduction in permission-related support tickets** (estimated 50 tickets/month → 35 tickets/month)
- **Average 15 minutes saved per incident** (no admin investigation needed)
- **Improved user trust** (transparency builds confidence in the system)

**Real-World Example**:
```
User: Sarah (Field Engineer)
Action: Clicks "Sync Data" button (disabled)
Current UX: Button is grayed out, no explanation
New UX:
  ┌───────────────────────────────────┐
  │ 🤖 Why can't I sync?              │
  │                                   │
  │ You cannot sync because:          │
  │ • Your role (Field Engineer)      │
  │   lacks pems:sync capability      │
  │ • Organization is Suspended       │
  │                                   │
  │ 💡 How to resolve:                │
  │ 1. Request role upgrade to        │
  │    Project Manager                 │
  │    Contact: admin@company.com     │
  │    ETA: 1 business day            │
  │                                   │
  │ 2. Ask admin to reactivate org    │
  │    Contact: Billing Dept          │
  │                                   │
  │ [Request Access] [Dismiss]        │
  └───────────────────────────────────┘
```

**Key Architectural Decision**: The AI explanation service runs SYNCHRONOUSLY on button hover (not async) because:
1. Explanations must feel instant (<300ms)
2. Permission chains are deterministic (cacheable)
3. Cache hit rate is high (same buttons checked repeatedly)
4. Fallback to generic message if AI service unavailable

---

## BUSINESS CONTEXT

### User Stories

**Story 1: Frustrated Field Engineer**
```gherkin
As a Field Engineer
I want to understand why I cannot sync PEMS data
So that I can take action to resolve the issue myself

Acceptance Criteria:
- GIVEN I am a Field Engineer without pems:sync capability
- WHEN I hover over the disabled "Sync Data" button
- THEN I see a tooltip explaining:
  1. My role lacks the required capability
  2. The exact capability needed (pems:sync)
  3. Who can grant this capability (admin contact)
  4. Estimated time to resolution (1 business day)
- AND I can click "Request Access" to send pre-filled escalation email
```

**Story 2: Admin Debugging Permission Issues**
```gherkin
As a System Administrator
I want to see the complete permission chain for any denied action
So that I can debug complex permission scenarios

Acceptance Criteria:
- GIVEN I am debugging a user's permission issue
- WHEN I view the permission tooltip in "Admin Debug Mode"
- THEN I see:
  1. Complete permission chain (5 checks: user status, org status, role, capability, resource lock)
  2. Which check(s) failed
  3. Confidence score from AI explanation (>90% = high confidence)
  4. Option to export permission audit log
```

**Story 3: New User Onboarding**
```gherkin
As a new Project Manager
I want to understand what features I can and cannot access
So that I can learn the system's security model

Acceptance Criteria:
- GIVEN I am a newly onboarded Project Manager
- WHEN I explore the UI and hover over various buttons
- THEN I receive educational tooltips explaining:
  1. Why certain features are locked (org suspended, role restriction, etc.)
  2. What permissions I DO have (positive framing)
  3. How the system's security model works (general education)
```

### Security Requirements (CRITICAL)

**🚨 AI Explanation Service MUST NEVER expose sensitive data in tooltips:**

```typescript
// ❌ WRONG - Exposes actual cost data to masked user
"You cannot view financial details. This item costs $450,000."

// ✅ CORRECT - Uses relative indicators only
"You cannot view financial details. This item has HIGH budget impact (Top 5% of crane costs)."

// ❌ WRONG - Exposes admin contact email to untrusted user
"Contact admin@supersecretdomain.com to request access."

// ✅ CORRECT - Uses organization's public support contact
"Contact your organization administrator via the Help Center to request access."

// ❌ WRONG - Reveals internal permission IDs
"You lack permission perm_12345_write_internal."

// ✅ CORRECT - Uses human-readable capability names
"You lack the 'pfa:update' capability. This allows modifying PFA records."
```

**Permission Chain Analysis Rules**:
1. **User Status Check**: User must be `serviceStatus = 'active'` (not suspended or locked)
2. **Organization Status Check**: Organization must be `serviceStatus = 'active'` (not suspended or archived)
3. **Role Check**: User's role must grant the required capability
4. **Capability Override Check**: User may have individual capability overrides
5. **Resource Lock Check**: Specific resource (e.g., PFA record) may be locked

**Example Permission Chain for "Sync Data" button**:
```typescript
const permissionChain = [
  {
    check: 'User is active',
    result: true, // PASS
    reason: 'User status: active'
  },
  {
    check: 'Organization is active',
    result: false, // FAIL
    reason: 'Organization status: suspended (payment overdue)'
  },
  {
    check: 'User has pems:sync capability',
    result: false, // FAIL
    reason: 'Field Engineer role does not include pems:sync'
  }
];
```

**AI Prompt Template (sent to AI service)**:
```typescript
const prompt = `
You are a helpful assistant explaining permission restrictions to a construction equipment manager.

User Context:
- Username: ${user.username}
- Role: ${user.role}
- Organization: ${org.name}

Permission Chain Analysis (5 checks performed):
${permissionChain.map((c, i) => `
  ${i + 1}. ${c.check}: ${c.result ? '✅ PASS' : '❌ FAIL'}
     Reason: ${c.reason}
`).join('\n')}

Action Attempted: ${actionName} (e.g., "Sync PEMS Data")

Instructions:
1. Explain in 2-3 sentences WHY the user cannot perform this action
2. List ACTIONABLE steps to resolve (contact admin, request role upgrade, etc.)
3. Estimate time to resolution (1 hour, 1 day, 1 week)
4. Use friendly, non-technical language
5. NEVER expose sensitive data (costs, internal IDs, admin emails)
6. If multiple checks failed, prioritize the most actionable one

Output Format (JSON):
{
  "summary": "Short explanation (1 sentence)",
  "reasons": ["Reason 1", "Reason 2"],
  "resolveActions": [
    { "action": "Request role upgrade", "contact": "admin@example.com", "eta": "1 business day" }
  ],
  "confidence": 0.95 // How confident are you in this explanation?
}
`;
```

### UX Intelligence Enhancements

**Progressive Disclosure**:
```typescript
// Level 1: Hover (300ms delay) - Show summary
<Tooltip>
  You cannot sync because your role lacks the required capability.
  [Learn More]
</Tooltip>

// Level 2: Click "Learn More" - Show full explanation
<Modal>
  🤖 Why can't I sync?

  You cannot sync because:
  • Your role (Field Engineer) lacks pems:sync capability
  • Organization is Suspended

  💡 How to resolve:
  1. Request role upgrade to Project Manager
     Contact: admin@company.com
     ETA: 1 business day

  [Request Access] [Dismiss]
</Modal>

// Level 3: Admin Debug Mode - Show technical details
<AdminDebugPanel>
  Permission Chain Analysis (5 checks):
  1. ✅ User is active (user.serviceStatus = 'active')
  2. ❌ Organization is active (org.serviceStatus = 'suspended')
  3. ❌ User has pems:sync capability (role 'Field Engineer' does not include)
  4. N/A Capability override check (no overrides)
  5. N/A Resource lock check (no resource-specific locks)

  AI Confidence: 95%
  Cache Hit: Yes (explanation served from cache)
  Generation Time: 12ms
</AdminDebugPanel>
```

**Context-Aware Help**:
```typescript
// Different explanations for different user types

// Field Engineer (non-technical user)
"You don't have permission to sync data. Ask your project manager or admin for access."

// Project Manager (technical user)
"Your role lacks the 'pems:sync' capability. Request a role upgrade or custom capability grant from IT."

// Admin (debugging)
"User 'john_doe' (Field Engineer) lacks pems:sync. Role template does not include this capability. Check UserOrganization.capabilityOverrides for custom grants."
```

---

## TECHNICAL SPECIFICATION

### Database Schema (No Changes Required)

**Context**: Use existing `User`, `UserOrganization`, and `Role` tables from Phase 1.

### Backend API

**File**: `backend/src/services/ai/PermissionExplanationService.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { LRUCache } from 'lru-cache';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface PermissionChainCheck {
  check: string;
  result: boolean;
  reason: string;
}

interface PermissionExplanation {
  summary: string;
  reasons: string[];
  resolveActions: {
    action: string;
    contact: string;
    eta: string;
  }[];
  confidence: number;
  permissionChain: PermissionChainCheck[];
}

interface ExplainPermissionDenialParams {
  userId: string;
  organizationId: string;
  action: string; // e.g., 'pems:sync', 'pfa:update', 'settings:manage'
}

export class PermissionExplanationService {
  private prisma: PrismaClient;
  private genAI: GoogleGenerativeAI;
  private cache: LRUCache<string, PermissionExplanation>;

  constructor() {
    this.prisma = new PrismaClient();
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

    // Cache explanations for 15 minutes (permission changes are infrequent)
    this.cache = new LRUCache<string, PermissionExplanation>({
      max: 1000, // Cache 1000 explanations
      ttl: 1000 * 60 * 15, // 15 minutes
      updateAgeOnGet: true
    });
  }

  /**
   * Explain why a user is denied permission for a specific action
   *
   * @returns PermissionExplanation if denied, null if allowed
   */
  async explainPermissionDenial(
    params: ExplainPermissionDenialParams
  ): Promise<PermissionExplanation | null> {
    const { userId, organizationId, action } = params;

    // Check cache first (permission chains are deterministic)
    const cacheKey = `${userId}:${organizationId}:${action}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`[PermissionExplanation] Cache hit for ${cacheKey}`);
      return cached;
    }

    // Analyze permission chain (5 checks)
    const permissionChain = await this.analyzePermissionChain(params);

    // If all checks pass, user has permission (no explanation needed)
    const allPassed = permissionChain.every(c => c.result);
    if (allPassed) {
      return null; // No denial to explain
    }

    // Generate AI explanation for failed checks
    const explanation = await this.generateExplanation({
      userId,
      organizationId,
      action,
      permissionChain
    });

    // Cache explanation
    this.cache.set(cacheKey, explanation);

    return explanation;
  }

  /**
   * Analyze the permission chain for a given action
   * Returns array of 5 checks (user status, org status, role, override, resource lock)
   */
  private async analyzePermissionChain(
    params: ExplainPermissionDenialParams
  ): Promise<PermissionChainCheck[]> {
    const { userId, organizationId, action } = params;

    // Fetch user, org, and user-org relationship
    const [user, org, userOrg] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.organization.findUnique({ where: { id: organizationId } }),
      this.prisma.userOrganization.findUnique({
        where: {
          userId_organizationId: { userId, organizationId }
        },
        include: { role: true }
      })
    ]);

    if (!user || !org || !userOrg) {
      throw new Error('User, org, or user-org relationship not found');
    }

    const chain: PermissionChainCheck[] = [];

    // Check 1: User is active (not suspended or locked)
    chain.push({
      check: 'User is active',
      result: user.serviceStatus === 'active',
      reason: user.serviceStatus === 'active'
        ? 'User status: active'
        : `User status: ${user.serviceStatus}`
    });

    // Check 2: Organization is active (not suspended or archived)
    chain.push({
      check: 'Organization is active',
      result: org.serviceStatus === 'active',
      reason: org.serviceStatus === 'active'
        ? 'Organization status: active'
        : `Organization status: ${org.serviceStatus} ${org.serviceStatus === 'suspended' ? '(payment overdue)' : ''}`
    });

    // Check 3: User has required capability (from role)
    const roleCapabilities = userOrg.role?.defaultCapabilities as Record<string, boolean> || {};
    const hasCapability = roleCapabilities[action] === true;

    chain.push({
      check: `User has ${action} capability`,
      result: hasCapability,
      reason: hasCapability
        ? `${userOrg.role?.name} role includes ${action}`
        : `${userOrg.role?.name} role does not include ${action}`
    });

    // Check 4: Capability override (individual grants/denies)
    const overrides = userOrg.capabilityOverrides as Record<string, boolean> || {};
    const hasOverride = action in overrides;
    const overrideGranted = overrides[action] === true;

    chain.push({
      check: 'Capability override check',
      result: hasOverride ? overrideGranted : true, // No override = pass
      reason: hasOverride
        ? (overrideGranted ? `Custom grant: ${action}` : `Custom deny: ${action}`)
        : 'No custom overrides'
    });

    // Check 5: Resource-specific lock (future enhancement)
    // For now, always pass (no resource locks implemented yet)
    chain.push({
      check: 'Resource lock check',
      result: true,
      reason: 'No resource-specific locks'
    });

    return chain;
  }

  /**
   * Generate AI explanation using Google Gemini
   */
  private async generateExplanation(params: {
    userId: string;
    organizationId: string;
    action: string;
    permissionChain: PermissionChainCheck[];
  }): Promise<PermissionExplanation> {
    const { userId, organizationId, action, permissionChain } = params;

    // Fetch user and org details for context
    const [user, org] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.organization.findUnique({ where: { id: organizationId } })
    ]);

    if (!user || !org) {
      throw new Error('User or org not found');
    }

    const userOrg = await this.prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: { userId, organizationId }
      },
      include: { role: true }
    });

    // Build AI prompt
    const prompt = `
You are a helpful assistant explaining permission restrictions to a construction equipment manager.

User Context:
- Username: ${user.username}
- Role: ${userOrg?.role?.name || 'No role assigned'}
- Organization: ${org.name}

Permission Chain Analysis (5 checks performed):
${permissionChain.map((c, i) => `
  ${i + 1}. ${c.check}: ${c.result ? '✅ PASS' : '❌ FAIL'}
     Reason: ${c.reason}
`).join('\n')}

Action Attempted: ${this.getActionDisplayName(action)}

Instructions:
1. Explain in 2-3 sentences WHY the user cannot perform this action
2. List ACTIONABLE steps to resolve (contact admin, request role upgrade, etc.)
3. Estimate time to resolution (1 hour, 1 day, 1 week)
4. Use friendly, non-technical language
5. NEVER expose sensitive data (costs, internal IDs, admin emails)
6. If multiple checks failed, prioritize the most actionable one

Output Format (JSON):
{
  "summary": "Short explanation (1 sentence)",
  "reasons": ["Reason 1", "Reason 2"],
  "resolveActions": [
    { "action": "Request role upgrade", "contact": "admin@example.com", "eta": "1 business day" }
  ],
  "confidence": 0.95
}
`;

    try {
      // Call Google Gemini AI
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Parse JSON response (remove markdown code fences if present)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI did not return valid JSON');
      }

      const aiResponse = JSON.parse(jsonMatch[0]);

      return {
        summary: aiResponse.summary,
        reasons: aiResponse.reasons,
        resolveActions: aiResponse.resolveActions,
        confidence: aiResponse.confidence,
        permissionChain
      };
    } catch (error) {
      console.error('[PermissionExplanation] AI generation failed:', error);

      // Fallback to rule-based explanation
      return this.generateFallbackExplanation({
        userId,
        organizationId,
        action,
        permissionChain
      });
    }
  }

  /**
   * Fallback explanation if AI service unavailable
   */
  private generateFallbackExplanation(params: {
    userId: string;
    organizationId: string;
    action: string;
    permissionChain: PermissionChainCheck[];
  }): PermissionExplanation {
    const { permissionChain, action } = params;

    // Find first failed check
    const firstFailure = permissionChain.find(c => !c.result);

    if (!firstFailure) {
      return {
        summary: 'Permission denied',
        reasons: ['Unable to determine reason. Contact your administrator.'],
        resolveActions: [
          { action: 'Contact administrator', contact: 'admin@example.com', eta: '1 business day' }
        ],
        confidence: 0.5,
        permissionChain
      };
    }

    // Rule-based explanation
    const summary = `You cannot ${this.getActionDisplayName(action)} because ${firstFailure.reason.toLowerCase()}.`;
    const reasons = [firstFailure.reason];
    const resolveActions = this.generateFallbackActions(firstFailure);

    return {
      summary,
      reasons,
      resolveActions,
      confidence: 0.75, // Rule-based has medium confidence
      permissionChain
    };
  }

  /**
   * Generate fallback actions based on failure type
   */
  private generateFallbackActions(
    failure: PermissionChainCheck
  ): { action: string; contact: string; eta: string }[] {
    if (failure.check.includes('User is active')) {
      return [
        { action: 'Contact administrator to reactivate account', contact: 'admin@example.com', eta: '1 business day' }
      ];
    }

    if (failure.check.includes('Organization is active')) {
      return [
        { action: 'Contact billing department to reactivate organization', contact: 'billing@example.com', eta: '2-3 business days' }
      ];
    }

    if (failure.check.includes('capability')) {
      return [
        { action: 'Request role upgrade or capability grant from administrator', contact: 'admin@example.com', eta: '1 business day' }
      ];
    }

    return [
      { action: 'Contact your organization administrator for assistance', contact: 'admin@example.com', eta: '1 business day' }
    ];
  }

  /**
   * Convert action key to human-readable name
   */
  private getActionDisplayName(action: string): string {
    const displayNames: Record<string, string> = {
      'pems:sync': 'Sync PEMS Data',
      'pfa:read': 'View PFA Records',
      'pfa:update': 'Modify PFA Records',
      'pfa:delete': 'Delete PFA Records',
      'settings:manage': 'Manage Settings',
      'users:manage': 'Manage Users',
      'financials:view': 'View Financial Details'
    };

    return displayNames[action] || action;
  }
}
```

**API Endpoint**:

**File**: `backend/src/controllers/permissionExplanationController.ts`

```typescript
import { Request, Response } from 'express';
import { PermissionExplanationService } from '../services/ai/PermissionExplanationService';

const explanationService = new PermissionExplanationService();

export const explainPermissionDenial = async (req: Request, res: Response) => {
  try {
    const { userId, organizationId, action } = req.body;

    // Validate inputs
    if (!userId || !organizationId || !action) {
      return res.status(400).json({
        error: 'Missing required fields: userId, organizationId, action'
      });
    }

    // Generate explanation
    const explanation = await explanationService.explainPermissionDenial({
      userId,
      organizationId,
      action
    });

    if (!explanation) {
      // User has permission (no denial to explain)
      return res.status(200).json({
        allowed: true,
        explanation: null
      });
    }

    // User is denied (return explanation)
    return res.status(200).json({
      allowed: false,
      explanation
    });
  } catch (error) {
    console.error('[explainPermissionDenial] Error:', error);
    return res.status(500).json({
      error: 'Failed to generate permission explanation',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
```

**Route Registration**:

**File**: `backend/src/routes/permissionRoutes.ts`

```typescript
import express from 'express';
import { explainPermissionDenial } from '../controllers/permissionExplanationController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// POST /api/permissions/explain - Explain permission denial
router.post('/explain', explainPermissionDenial);

export default router;
```

**Register in server**:

**File**: `backend/src/server.ts`

```typescript
// Add import
import permissionRoutes from './routes/permissionRoutes';

// Register route
app.use('/api/permissions', permissionRoutes);
```

---

### Frontend Components

**File**: `components/PermissionTooltip.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Tooltip, Modal, Button, Spinner } from '@nextui-org/react';
import { AlertCircle, Info, ExternalLink } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { useAuth } from '@/contexts/AuthContext';

interface PermissionTooltipProps {
  /**
   * The action being attempted (e.g., 'pems:sync')
   */
  action: string;

  /**
   * The child element (usually a disabled button)
   */
  children: React.ReactElement;

  /**
   * Custom organization ID (defaults to currentUser.organizationId)
   */
  organizationId?: string;

  /**
   * Show admin debug mode (technical details)
   */
  debugMode?: boolean;
}

interface PermissionExplanation {
  summary: string;
  reasons: string[];
  resolveActions: {
    action: string;
    contact: string;
    eta: string;
  }[];
  confidence: number;
  permissionChain: {
    check: string;
    result: boolean;
    reason: string;
  }[];
}

export const PermissionTooltip: React.FC<PermissionTooltipProps> = ({
  action,
  children,
  organizationId,
  debugMode = false
}) => {
  const { currentUser } = useAuth();
  const [explanation, setExplanation] = useState<PermissionExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullModal, setShowFullModal] = useState(false);

  const orgId = organizationId || currentUser?.organizationId;

  /**
   * Fetch explanation from backend
   */
  const fetchExplanation = async () => {
    if (!currentUser || !orgId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/api/permissions/explain', {
        userId: currentUser.id,
        organizationId: orgId,
        action
      });

      if (response.data.allowed) {
        // User has permission (no tooltip needed)
        setExplanation(null);
      } else {
        // User is denied (show explanation)
        setExplanation(response.data.explanation);
      }
    } catch (err) {
      console.error('[PermissionTooltip] Error fetching explanation:', err);
      setError('Unable to load explanation. Contact your administrator.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch explanation on hover (300ms delay)
   */
  const handleHover = () => {
    // Delay explanation fetch to avoid unnecessary API calls
    setTimeout(() => {
      if (!explanation && !loading) {
        fetchExplanation();
      }
    }, 300);
  };

  /**
   * Open full explanation modal
   */
  const handleLearnMore = () => {
    setShowFullModal(true);
  };

  /**
   * Send access request email (pre-filled)
   */
  const handleRequestAccess = () => {
    if (!explanation || explanation.resolveActions.length === 0) return;

    const firstAction = explanation.resolveActions[0];
    const subject = `Access Request: ${action}`;
    const body = `Hi,\n\nI would like to request access to "${action}".\n\nReason: ${explanation.summary}\n\nPlease let me know the next steps.\n\nThank you,\n${currentUser?.username}`;

    // Open email client
    window.location.href = `mailto:${firstAction.contact}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  /**
   * Render tooltip content (summary)
   */
  const renderTooltipContent = () => {
    if (loading) {
      return (
        <div className="flex items-center space-x-2">
          <Spinner size="sm" />
          <span>Analyzing permissions...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center space-x-2 text-red-500">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      );
    }

    if (!explanation) {
      return null; // No tooltip if user has permission
    }

    return (
      <div className="max-w-sm space-y-2">
        <div className="flex items-start space-x-2">
          <Info size={16} className="mt-0.5 flex-shrink-0" />
          <p className="text-sm">{explanation.summary}</p>
        </div>

        <button
          onClick={handleLearnMore}
          className="text-xs text-blue-500 hover:underline flex items-center space-x-1"
        >
          <span>Learn More</span>
          <ExternalLink size={12} />
        </button>
      </div>
    );
  };

  /**
   * Render full explanation modal
   */
  const renderFullModal = () => {
    if (!explanation) return null;

    return (
      <Modal
        isOpen={showFullModal}
        onClose={() => setShowFullModal(false)}
        size="2xl"
        scrollBehavior="inside"
      >
        <Modal.Header>
          <h3 className="text-lg font-semibold flex items-center space-x-2">
            <span>🤖</span>
            <span>Why can't I {action.split(':')[1]}?</span>
          </h3>
        </Modal.Header>

        <Modal.Body>
          {/* Summary */}
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-700 mb-2">You cannot {action.split(':')[1]} because:</h4>
              <ul className="list-disc list-inside space-y-1">
                {explanation.reasons.map((reason, i) => (
                  <li key={i} className="text-sm text-gray-600">• {reason}</li>
                ))}
              </ul>
            </div>

            {/* Resolution Steps */}
            {explanation.resolveActions.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-700 mb-2">💡 How to resolve:</h4>
                <div className="space-y-3">
                  {explanation.resolveActions.map((actionItem, i) => (
                    <div key={i} className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm font-medium text-blue-900">{i + 1}. {actionItem.action}</p>
                      <p className="text-xs text-blue-700 mt-1">Contact: {actionItem.contact}</p>
                      <p className="text-xs text-blue-600">ETA: {actionItem.eta}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Debug Mode */}
            {debugMode && (
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium text-gray-700 mb-2">🔧 Admin Debug Info</h4>
                <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                  <p className="text-xs font-mono">Permission Chain Analysis:</p>
                  {explanation.permissionChain.map((check, i) => (
                    <div key={i} className="text-xs font-mono">
                      {i + 1}. {check.result ? '✅' : '❌'} {check.check}
                      <br />
                      <span className="text-gray-600 ml-4">→ {check.reason}</span>
                    </div>
                  ))}
                  <p className="text-xs text-gray-600 mt-2">AI Confidence: {(explanation.confidence * 100).toFixed(0)}%</p>
                </div>
              </div>
            )}
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button auto flat color="error" onClick={() => setShowFullModal(false)}>
            Dismiss
          </Button>
          {explanation.resolveActions.length > 0 && (
            <Button auto color="primary" onClick={handleRequestAccess}>
              Request Access
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    );
  };

  return (
    <>
      <Tooltip
        content={renderTooltipContent()}
        placement="top"
        delay={300} // 300ms hover delay
        onMouseEnter={handleHover}
      >
        {children}
      </Tooltip>

      {renderFullModal()}
    </>
  );
};
```

**Usage Example**:

**File**: `components/admin/ApiConnectivity.tsx` (Update sync button)

```typescript
import { PermissionTooltip } from '@/components/PermissionTooltip';

// Wrap disabled "Sync Data" button with PermissionTooltip
<PermissionTooltip action="pems:sync" organizationId={api.organizationId}>
  <Button
    disabled={!canSync}
    onClick={() => handleSyncClick(api.id)}
    className="..."
  >
    Sync Data
  </Button>
</PermissionTooltip>
```

---

## AI ENFORCEMENT (🚨 CRITICAL)

### AI Service Requirements

**AI Provider**: Google Gemini 1.5 Flash (fast, cheap, suitable for simple explanations)

**Latency Budget**: <500ms for AI inference (cached responses <50ms)

**Fallback Strategy**:
- **Primary**: Google Gemini AI (best quality)
- **Fallback 1**: Rule-based explanation (medium quality, instant)
- **Fallback 2**: Generic message (low quality, always available)

**Security Rules**:
1. ❌ NEVER expose financial data to masked users
2. ❌ NEVER expose admin contact emails in tooltips (use org support contact)
3. ❌ NEVER expose internal permission IDs or database schema
4. ✅ ALWAYS use human-readable capability names
5. ✅ ALWAYS validate AI response format before returning to frontend

**Prompt Injection Protection**:
```typescript
// Sanitize user input before sending to AI
const sanitizeInput = (input: string): string => {
  // Remove prompt injection attempts
  return input
    .replace(/system:|assistant:|user:/gi, '') // Remove role markers
    .replace(/\n\n\n+/g, '\n\n') // Remove excessive newlines
    .substring(0, 500); // Limit length
};
```

**AI Response Validation**:
```typescript
// Validate AI response schema
const validateExplanation = (response: any): boolean => {
  if (!response || typeof response !== 'object') return false;
  if (!response.summary || typeof response.summary !== 'string') return false;
  if (!Array.isArray(response.reasons)) return false;
  if (!Array.isArray(response.resolveActions)) return false;
  if (typeof response.confidence !== 'number') return false;
  if (response.confidence < 0 || response.confidence > 1) return false;
  return true;
};
```

---

## UX ENFORCEMENT (🚨 CRITICAL)

### Latency Budgets

| Action | Target | Max Acceptable | UX Fallback |
|--------|--------|----------------|-------------|
| **Hover Tooltip (Cached)** | <50ms | 100ms | Instant (cache hit) |
| **Hover Tooltip (Uncached)** | <300ms | 500ms | Show "Analyzing..." spinner |
| **Full Modal Open** | <100ms | 200ms | Skeleton screen |
| **AI Fallback** | 0ms | N/A | Rule-based explanation (instant) |

### Loading States

**Tooltip Loading**:
```tsx
<Tooltip content={
  <div className="flex items-center space-x-2">
    <Spinner size="sm" />
    <span>Analyzing permissions...</span>
  </div>
}>
  <Button disabled>Sync Data</Button>
</Tooltip>
```

**Modal Loading** (if AI is slow):
```tsx
<Modal.Body>
  <div className="space-y-4">
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-5/6" />
  </div>
</Modal.Body>
```

### Error States

**AI Service Down**:
```tsx
<Tooltip content={
  <div className="flex items-center space-x-2 text-red-500">
    <AlertCircle size={16} />
    <span>Unable to load explanation. Contact your administrator.</span>
  </div>
}>
  <Button disabled>Sync Data</Button>
</Tooltip>
```

**Network Timeout**:
```tsx
<Modal.Body>
  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
    <p className="text-sm text-yellow-800">
      ⏳ This is taking longer than usual. You may close this and try again later.
    </p>
  </div>
</Modal.Body>
```

### Accessibility (WCAG AA)

**Keyboard Navigation**:
- **Tab**: Focus on disabled button
- **Enter or Space**: Open full explanation modal
- **Esc**: Close modal

**Screen Reader Support**:
```tsx
<button
  disabled
  aria-describedby="permission-tooltip"
  aria-label="Sync Data (disabled). Press Enter to learn why."
>
  Sync Data
</button>

<div id="permission-tooltip" role="tooltip" className="sr-only">
  {explanation?.summary}
</div>
```

**Visual Indicators**:
- ❌ Don't rely on color alone (use icons: 🔒, ⚠️, ✅)
- ✅ Provide text alternatives for icons
- ✅ Ensure 4.5:1 contrast ratio for all text

---

## YOUR MISSION

You will implement the Context-Aware Access Explanation system in **7 steps**:

### Step 1: Backend AI Service (4 hours)

Create `backend/src/services/ai/PermissionExplanationService.ts`:
1. Implement `analyzePermissionChain()` (5 checks)
2. Implement `generateExplanation()` (Google Gemini integration)
3. Implement `generateFallbackExplanation()` (rule-based)
4. Add LRU cache (15-minute TTL, 1000 entries)
5. Add unit tests for permission chain logic

**Success Criteria**:
- ✅ Permission chain correctly identifies all 5 checks
- ✅ AI generates explanations with >90% confidence
- ✅ Fallback works when AI unavailable
- ✅ Cache hit rate >80% after warmup

### Step 2: Backend API Endpoint (1 hour)

Create `backend/src/controllers/permissionExplanationController.ts`:
1. Implement `explainPermissionDenial` endpoint
2. Add input validation
3. Add error handling
4. Register route in `server.ts`

**Success Criteria**:
- ✅ Endpoint returns 200 with explanation for denied actions
- ✅ Endpoint returns 200 with `allowed: true` for permitted actions
- ✅ Endpoint validates required fields (userId, organizationId, action)

### Step 3: Frontend Tooltip Component (4 hours)

Create `components/PermissionTooltip.tsx`:
1. Implement hover-triggered tooltip (300ms delay)
2. Implement "Learn More" full modal
3. Implement "Request Access" email template
4. Add loading states (skeleton screen)
5. Add error states (fallback message)

**Success Criteria**:
- ✅ Tooltip appears on hover (300ms delay)
- ✅ Full modal opens on "Learn More" click
- ✅ Email pre-fills with explanation details
- ✅ Loading spinner shows for slow AI responses

### Step 4: Integrate Tooltip into Existing UI (2 hours)

Update existing components to use `PermissionTooltip`:
1. Wrap "Sync Data" button in `ApiConnectivity.tsx`
2. Wrap "Manage Settings" button in admin UI
3. Wrap "Manage Users" button in admin UI
4. Wrap disabled action buttons in Timeline/CommandDeck

**Success Criteria**:
- ✅ All disabled buttons have context tooltips
- ✅ Tooltips explain specific denial reasons
- ✅ No visual regression (buttons still look disabled)

### Step 5: Admin Debug Mode (1 hour)

Add admin-only debug mode to tooltip:
1. Add `debugMode` prop to `PermissionTooltip`
2. Show technical permission chain details
3. Show AI confidence score
4. Show cache hit/miss status

**Success Criteria**:
- ✅ Debug mode shows all 5 permission checks
- ✅ Debug mode shows AI confidence score
- ✅ Debug mode accessible only to admins

### Step 6: Testing (3 hours)

Write integration tests:
1. Test permission chain analysis (5 scenarios)
2. Test AI explanation generation (3 scenarios)
3. Test fallback explanation (2 scenarios)
4. Test cache behavior (hit/miss)
5. Test frontend tooltip behavior (hover, click, keyboard)

**Test Scenarios**:
- **Scenario 1**: User suspended → Tooltip explains user status
- **Scenario 2**: Org suspended → Tooltip explains org status
- **Scenario 3**: Missing capability → Tooltip suggests role upgrade
- **Scenario 4**: Multiple failures → Tooltip prioritizes most actionable
- **Scenario 5**: AI service down → Fallback explanation works

**Success Criteria**:
- ✅ All 5 permission chain scenarios pass
- ✅ AI explanations have >90% confidence
- ✅ Fallback works when AI fails
- ✅ Cache reduces AI calls by 80%

### Step 7: Documentation (1 hour)

Update documentation:
1. Add API reference to `docs/backend/API_REFERENCE.md`
2. Add component docs to `docs/frontend/COMPONENTS.md`
3. Add usage examples to `CLAUDE.md`
4. Update `README.md` with AI features list

**Success Criteria**:
- ✅ API endpoint documented with request/response examples
- ✅ Component props documented with usage examples
- ✅ CLAUDE.md includes "Common Tasks: Add Permission Tooltip"

---

## DELIVERABLES

You must deliver the following files:

### 1. Backend Service

**File**: `backend/src/services/ai/PermissionExplanationService.ts` (350+ lines)
- Permission chain analysis (5 checks)
- AI explanation generation (Google Gemini)
- Fallback rule-based explanation
- LRU cache (15-minute TTL)

### 2. Backend API Controller

**File**: `backend/src/controllers/permissionExplanationController.ts` (80+ lines)
- `explainPermissionDenial` endpoint
- Input validation
- Error handling

### 3. Backend Route

**File**: `backend/src/routes/permissionRoutes.ts` (15+ lines)
- Route registration
- Authentication middleware

### 4. Frontend Component

**File**: `components/PermissionTooltip.tsx` (300+ lines)
- Hover-triggered tooltip
- Full explanation modal
- Email template generation
- Loading/error states

### 5. Integration Updates

**Files**:
- `components/admin/ApiConnectivity.tsx` (update sync button)
- `components/CommandDeck.tsx` (wrap action buttons)
- `components/Timeline.tsx` (wrap disabled controls)

### 6. Integration Tests

**File**: `backend/tests/integration/permissionExplanation.test.ts` (200+ lines)
- Permission chain tests (5 scenarios)
- AI explanation tests (3 scenarios)
- Fallback tests (2 scenarios)
- Cache tests (hit/miss)

---

## CONSTRAINTS

### ❌ Do NOT

1. ❌ Expose sensitive data in AI explanations (costs, internal IDs, admin emails)
2. ❌ Call AI service synchronously on every button hover (use cache)
3. ❌ Show technical error messages to non-admin users
4. ❌ Hardcode admin contact emails (use org support contact from database)
5. ❌ Skip fallback explanation (AI service may be unavailable)
6. ❌ Make tooltip blocking (must not prevent UI interaction)

### ✅ Do ENFORCE

1. ✅ Cache AI explanations for 15 minutes (permission changes are rare)
2. ✅ Validate AI response schema before returning to frontend
3. ✅ Use rule-based fallback if AI unavailable
4. ✅ Add 300ms hover delay before fetching explanation
5. ✅ Sanitize user input before sending to AI (prompt injection protection)
6. ✅ Show admin debug mode only for users with admin role

---

## VERIFICATION QUESTIONS

Before marking this task as complete, answer these questions:

1. **Cache Effectiveness**: What is the cache hit rate after 10 minutes of usage? (Target: >80%)
2. **AI Accuracy**: What percentage of AI explanations have confidence >90%? (Target: >85%)
3. **Fallback Coverage**: Does fallback explanation work when AI service is down? (Test by disabling API key)
4. **Security**: Can non-privileged users see financial data in explanations? (Must be NO)
5. **Latency**: What is the p95 latency for cached tooltips? (Target: <100ms)
6. **Accessibility**: Can keyboard-only users access full explanations? (Must be YES)

---

## RELATED FILES

**Source Documents**:
- `docs/ADRs/ADR-005-multi-tenant-access-control/ADR-005-AI_OPPORTUNITIES.md` (Use Case 16)
- `docs/ADRs/ADR-005-multi-tenant-access-control/ADR-005-TEST_PLAN.md` (Lines 1169-1263)
- `docs/ADRs/ADR-005-multi-tenant-access-control/ADR-005-UX_SPEC.md` (Lines 518-576)

**Dependencies**:
- Phase 1 Complete: Database schema with User, UserOrganization, Role tables
- Phase 4 Complete: Frontend permission checking logic

**Next Task**: Phase 7, Task 7.2 (Financial Data Masking)

---

**END OF PROMPT BUNDLE**

Total Lines: ~1,450 lines

---

# Phase 7, Task 7.2: Financial Data Masking with Relative Indicators (AI Use Case 17)

**Agent**: @ux-technologist
**Estimated Duration**: 2 days
**Phase**: 7 (UX Intelligence)
**Dependencies**: Phase 4 Complete (Frontend Permission Enforcement)
**Status**: Ready to Execute

---

## SYSTEM CONTEXT

You are implementing **Use Case 17: Financial Data Masking with Relative Indicators** from ADR-005, an AI-powered system that hides absolute cost data from non-privileged users while providing actionable relative insights.

**The Problem**: Field Engineers and non-financial users need to understand budget impact of equipment decisions but should not see exact costs (company policy). Simply hiding costs ("***masked***") provides no decision-making value.

**The Solution**: AI translates absolute costs into relative indicators:
- **Absolute**: "$450,000 crane rental" → **Relative**: "⚠️ High Budget Impact (Top 5% of crane costs, 3.2x average)"
- Users make informed decisions without seeing exact costs
- AI provides actionable recommendations ("Consider standard 150T model instead")

**Business Value**:
- **Compliance**: Enforces financial data access policies without blocking workflow
- **Decision Quality**: Users still make cost-conscious decisions (relative indicators are sufficient)
- **Security**: 0% bypass rate (absolute costs never exposed in any API response)
- **User Trust**: Transparent masking (users know WHY costs are hidden)

**Real-World Example**:
```
User: Sarah (Field Engineer, no viewFinancialDetails capability)
Action: Views crane rental on timeline

Current UX:
  Crane - Mobile 200T
  Silo 4 | Dec 1-15 (15 days)
  Cost: ***masked***  ← Useless

New UX:
  🏗️ Crane - Mobile 200T
  Silo 4 | Dec 1-15 (15 days)

  [⚠️ High Budget Impact]

  Cost: ***masked***
  Impact: Top 5% of crane costs
  Comparison: 3.2x avg crane rental

  💡 This equipment is significantly more
     expensive than typical cranes.
     Consider reviewing duration or
     exploring alternatives.

  [View Details] [Suggest Alternatives]
```

**Key Architectural Decision**: Financial masking happens in **BOTH** backend API and frontend rendering:
1. **Backend API**: Never sends absolute costs to clients without `viewFinancialDetails` capability (security layer)
2. **Frontend**: Renders masked values with relative indicators (UX layer)
3. **AI Service**: Translates costs to percentiles and generates recommendations (intelligence layer)

**Security Model** (Defense in Depth):
```
Layer 1: API Response Filtering
  → Strip cost fields from JSON response
  → Add impactLevel, relativeComparison, percentile

Layer 2: Frontend Masking
  → Render "***masked***" for cost field
  → Show impact badge (High/Moderate/Within Budget)

Layer 3: Bypass Attempt Detection
  → Log attempts to access /api/pfa/records?includeFinancials=true
  → Alert security team on repeated attempts
```

---

## BUSINESS CONTEXT

### User Stories

**Story 1: Field Engineer Making Equipment Decision**
```gherkin
As a Field Engineer without financial access
I want to understand the budget impact of equipment choices
So that I can make cost-conscious decisions without seeing exact costs

Acceptance Criteria:
- GIVEN I have viewFinancialDetails = false
- WHEN I view a PFA record on the timeline
- THEN I see:
  1. Absolute cost is "***masked***"
  2. Relative indicator: "High Budget Impact" (red badge)
  3. Percentile: "Top 5% of crane costs"
  4. Comparison: "3.2x average crane rental"
  5. AI recommendation: "Consider standard 150T model"
- AND absolute cost is NOT exposed in:
  - Tooltip hover
  - Browser DevTools network tab
  - API response JSON
  - Export CSV
```

**Story 2: Project Manager Reviewing Portfolio**
```gherkin
As a Project Manager without financial access
I want to see which equipment lines have highest budget impact
So that I can prioritize cost optimization efforts

Acceptance Criteria:
- GIVEN I have viewFinancialDetails = false
- WHEN I view the portfolio summary
- THEN I see:
  1. Total items: 45 equipment lines
  2. Impact breakdown:
     - 3 high-impact items (Top 10%)
     - 10 moderate-impact items (50-90%)
     - 32 within-budget items (<50%)
  3. AI insight: "3 high-impact items account for 42% of total budget"
  4. Recommendation: "Review crane duration to reduce impact"
- AND absolute costs are NEVER shown
```

**Story 3: Admin Auditing Financial Masking**
```gherkin
As a System Administrator
I want to audit attempts to bypass financial masking
So that I can detect security policy violations

Acceptance Criteria:
- GIVEN I am reviewing audit logs
- WHEN a user without viewFinancialDetails attempts to access /api/pfa/records?includeFinancials=true
- THEN I see:
  1. Audit log entry with action: 'financial_access_attempt'
  2. User ID, timestamp, IP address
  3. Request parameters (includeFinancials=true)
  4. Response: 403 Forbidden
- AND security alert is sent after 3 failed attempts
```

### Financial Masking Rules

**What Gets Masked** (absolute values):
- `cost` field (calculated or imported)
- `monthlyRate` field (for rentals)
- `purchasePrice` field (for purchases)
- `planCost`, `forecastCost`, `actualCost` (aggregated totals)

**What Stays Visible** (relative indicators):
- `impactLevel`: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
- `percentile`: Number (0-100, e.g., 95 = top 5%)
- `relativeComparison`: String (e.g., "3.2x average")
- `impactDescription`: String (e.g., "Top 5% of crane costs")

**Percentile Calculation Logic**:
```typescript
// Calculate percentile within category
const calculatePercentile = (cost: number, category: string, allRecords: PfaRecord[]): number => {
  // Filter records in same category
  const categoryRecords = allRecords.filter(r => r.category === category);

  // Sort by cost ascending
  const sortedCosts = categoryRecords.map(r => r.cost).sort((a, b) => a - b);

  // Find position of current cost
  const position = sortedCosts.filter(c => c <= cost).length;

  // Calculate percentile (0-100)
  return Math.round((position / sortedCosts.length) * 100);
};

// Example: $450,000 crane
// Category: Cranes (100 total records)
// Sorted costs: [$10K, $12K, ..., $450K, $500K]
// Position: 95 out of 100
// Percentile: 95 (Top 5%)
```

**Impact Level Classification**:
```typescript
const getImpactLevel = (percentile: number): 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' => {
  if (percentile >= 90) return 'CRITICAL'; // Top 10%
  if (percentile >= 70) return 'HIGH';     // 70-90%
  if (percentile >= 50) return 'MODERATE'; // 50-70%
  return 'LOW';                            // Bottom 50%
};
```

**Relative Comparison**:
```typescript
const getRelativeComparison = (cost: number, avgCost: number): string => {
  const ratio = cost / avgCost;

  if (ratio >= 3) return `${ratio.toFixed(1)}x average`;
  if (ratio >= 1.5) return `${Math.round((ratio - 1) * 100)}% above average`;
  if (ratio >= 0.7) return 'Near average';
  return `${Math.round((1 - ratio) * 100)}% below average`;
};

// Example: $450,000 crane, avg $140,000
// Ratio: 3.2
// Result: "3.2x average"
```

### Security Requirements (CRITICAL)

**🚨 Bypass Attempt Detection**:

```typescript
// Detect attempts to access financial data via query params
app.use((req, res, next) => {
  const user = req.user; // From JWT token

  // Check if user has viewFinancialDetails capability
  if (!user || !user.capabilities.viewFinancialDetails) {
    // Log attempt to access financial data
    if (req.query.includeFinancials === 'true' ||
        req.query.showCosts === 'true' ||
        req.path.includes('/financial')) {

      // Create audit log
      prisma.auditLog.create({
        data: {
          userId: user.id,
          organizationId: user.organizationId,
          action: 'financial_access_attempt',
          resourceType: 'PfaRecord',
          metadata: {
            path: req.path,
            query: req.query,
            ip: req.ip
          },
          timestamp: new Date()
        }
      });

      // Return 403 Forbidden
      return res.status(403).json({
        error: 'FINANCIAL_ACCESS_DENIED',
        message: 'You do not have permission to view financial details.'
      });
    }
  }

  next();
});
```

**🚨 Response Sanitization** (Remove cost fields before sending to client):

```typescript
// Sanitize PFA records before sending to client
const sanitizePfaRecords = (
  records: PfaRecord[],
  userCapabilities: { viewFinancialDetails: boolean }
): any[] => {
  if (userCapabilities.viewFinancialDetails) {
    return records; // No masking for privileged users
  }

  // Mask financial fields
  return records.map(record => ({
    ...record,
    cost: '***masked***',
    monthlyRate: '***masked***',
    purchasePrice: '***masked***',
    planCost: '***masked***',
    forecastCost: '***masked***',
    actualCost: '***masked***',

    // Add relative indicators (calculated by AI service)
    impactLevel: record.impactLevel,
    percentile: record.percentile,
    relativeComparison: record.relativeComparison,
    impactDescription: record.impactDescription,
    aiInsight: record.aiInsight
  }));
};
```

**🚨 Export CSV Masking**:

```typescript
// Mask costs in CSV export
const generateMaskedCsv = (records: PfaRecord[], userCapabilities: { viewFinancialDetails: boolean }): string => {
  const headers = ['Description', 'Category', 'Cost', 'Impact Level', 'Percentile'];
  const rows = records.map(r => {
    const cost = userCapabilities.viewFinancialDetails
      ? r.cost.toString()
      : '***masked***';

    return [r.description, r.category, cost, r.impactLevel, r.percentile];
  });

  return [headers, ...rows].map(row => row.join(',')).join('\n');
};
```

---

## TECHNICAL SPECIFICATION

### Database Schema (No Changes Required)

**Context**: Use existing `PfaRecord` table. Add computed fields for relative indicators (not stored in DB).

### Backend AI Service

**File**: `backend/src/services/ai/FinancialMaskingService.ts`

```typescript
import { PrismaClient, PfaRecord } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LRUCache } from 'lru-cache';

interface MaskedPfaRecord extends Omit<PfaRecord, 'cost' | 'monthlyRate' | 'purchasePrice'> {
  cost: '***masked***';
  monthlyRate?: '***masked***';
  purchasePrice?: '***masked***';

  // Relative indicators (computed)
  impactLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  percentile: number; // 0-100 (95 = Top 5%)
  relativeComparison: string; // "3.2x average"
  impactDescription: string; // "Top 5% of crane costs"
  aiInsight: string; // AI-generated recommendation
}

interface TranslateParams {
  userId: string;
  organizationId: string;
  records: PfaRecord[];
  userCapabilities: { viewFinancialDetails: boolean };
}

interface PortfolioInsight {
  totalItems: number;
  highImpactCount: number;
  moderateImpactCount: number;
  lowImpactCount: number;
  summary: string; // "3 high-impact items account for 42% of total budget"
}

export class FinancialMaskingService {
  private prisma: PrismaClient;
  private genAI: GoogleGenerativeAI;
  private cache: LRUCache<string, MaskedPfaRecord[]>;

  constructor() {
    this.prisma = new PrismaClient();
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

    // Cache masked records for 5 minutes (percentiles change infrequently)
    this.cache = new LRUCache<string, MaskedPfaRecord[]>({
      max: 500, // Cache 500 user-org combinations
      ttl: 1000 * 60 * 5, // 5 minutes
      updateAgeOnGet: true
    });
  }

  /**
   * Translate financial data to relative indicators for masked users
   *
   * @returns MaskedPfaRecord[] if user lacks viewFinancialDetails, original records if allowed
   */
  async translateFinancialData(params: TranslateParams): Promise<{
    maskedRecords: MaskedPfaRecord[];
    portfolioInsight: PortfolioInsight;
  }> {
    const { userId, organizationId, records, userCapabilities } = params;

    // If user has viewFinancialDetails, return original records
    if (userCapabilities.viewFinancialDetails) {
      return {
        maskedRecords: records as any,
        portfolioInsight: this.calculatePortfolioInsight(records)
      };
    }

    // Check cache first
    const cacheKey = `${userId}:${organizationId}:${records.length}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`[FinancialMasking] Cache hit for ${cacheKey}`);
      return {
        maskedRecords: cached,
        portfolioInsight: this.calculatePortfolioInsight(records)
      };
    }

    // Translate to relative indicators
    const maskedRecords = await Promise.all(
      records.map(record => this.maskRecord(record, records))
    );

    // Cache result
    this.cache.set(cacheKey, maskedRecords);

    return {
      maskedRecords,
      portfolioInsight: this.calculatePortfolioInsight(records)
    };
  }

  /**
   * Mask a single record with relative indicators
   */
  private async maskRecord(
    record: PfaRecord,
    allRecords: PfaRecord[]
  ): Promise<MaskedPfaRecord> {
    // Calculate percentile within category
    const percentile = this.calculatePercentile(record.cost, record.category, allRecords);

    // Determine impact level
    const impactLevel = this.getImpactLevel(percentile);

    // Calculate average cost for category
    const avgCost = this.calculateAverageCost(record.category, allRecords);

    // Generate relative comparison
    const relativeComparison = this.getRelativeComparison(record.cost, avgCost);

    // Generate impact description
    const impactDescription = this.getImpactDescription(percentile, record.category);

    // Generate AI insight (async, use fallback if AI fails)
    const aiInsight = await this.generateAiInsight(record, percentile, avgCost);

    // Return masked record
    return {
      ...record,
      cost: '***masked***' as any,
      monthlyRate: record.source === 'Rental' ? ('***masked***' as any) : undefined,
      purchasePrice: record.source === 'Purchase' ? ('***masked***' as any) : undefined,

      // Relative indicators
      impactLevel,
      percentile,
      relativeComparison,
      impactDescription,
      aiInsight
    };
  }

  /**
   * Calculate percentile within category (0-100)
   */
  private calculatePercentile(
    cost: number,
    category: string,
    allRecords: PfaRecord[]
  ): number {
    // Filter records in same category
    const categoryRecords = allRecords.filter(r => r.category === category);

    if (categoryRecords.length === 0) return 50; // Default to median if no comparisons

    // Sort by cost ascending
    const sortedCosts = categoryRecords.map(r => r.cost).sort((a, b) => a - b);

    // Find position of current cost
    const position = sortedCosts.filter(c => c <= cost).length;

    // Calculate percentile (0-100)
    return Math.round((position / sortedCosts.length) * 100);
  }

  /**
   * Determine impact level based on percentile
   */
  private getImpactLevel(
    percentile: number
  ): 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
    if (percentile >= 90) return 'CRITICAL'; // Top 10%
    if (percentile >= 70) return 'HIGH';     // 70-90%
    if (percentile >= 50) return 'MODERATE'; // 50-70%
    return 'LOW';                            // Bottom 50%
  }

  /**
   * Calculate average cost for category
   */
  private calculateAverageCost(category: string, allRecords: PfaRecord[]): number {
    const categoryRecords = allRecords.filter(r => r.category === category);
    if (categoryRecords.length === 0) return 0;

    const sum = categoryRecords.reduce((acc, r) => acc + r.cost, 0);
    return sum / categoryRecords.length;
  }

  /**
   * Generate relative comparison string
   */
  private getRelativeComparison(cost: number, avgCost: number): string {
    if (avgCost === 0) return 'No comparison data';

    const ratio = cost / avgCost;

    if (ratio >= 3) return `${ratio.toFixed(1)}x average`;
    if (ratio >= 1.5) return `${Math.round((ratio - 1) * 100)}% above average`;
    if (ratio >= 0.7) return 'Near average';
    return `${Math.round((1 - ratio) * 100)}% below average`;
  }

  /**
   * Generate impact description
   */
  private getImpactDescription(percentile: number, category: string): string {
    if (percentile >= 95) return `Top 5% of ${category.toLowerCase()} costs`;
    if (percentile >= 90) return `Top 10% of ${category.toLowerCase()} costs`;
    if (percentile >= 75) return `Top 25% of ${category.toLowerCase()} costs`;
    if (percentile >= 50) return `Above average for ${category.toLowerCase()}`;
    return `Below average for ${category.toLowerCase()}`;
  }

  /**
   * Generate AI insight using Google Gemini
   */
  private async generateAiInsight(
    record: PfaRecord,
    percentile: number,
    avgCost: number
  ): Promise<string> {
    // Skip AI for low-impact items (save API costs)
    if (percentile < 70) {
      return 'This equipment is within typical budget range.';
    }

    const prompt = `
You are a cost optimization advisor for construction equipment.

Equipment Context:
- Description: ${record.description}
- Category: ${record.category}
- Source: ${record.source} (Rental or Purchase)
- Duration: ${record.duration} days
- Budget Impact: Top ${100 - percentile}% (high impact)

Cost Analysis:
- This item is ${this.getRelativeComparison(record.cost, avgCost)}
- Percentile: ${percentile}th

Instructions:
1. Explain WHY this equipment has high budget impact (1 sentence)
2. Suggest ONE actionable optimization (e.g., reduce duration, consider alternative model)
3. Be specific and constructive (avoid generic advice)
4. Keep response under 50 words

Output Format (plain text, no formatting):
`;

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const response = result.response.text();

      return response.trim().substring(0, 200); // Limit to 200 chars
    } catch (error) {
      console.error('[FinancialMasking] AI insight failed:', error);

      // Fallback to rule-based insight
      return this.generateFallbackInsight(percentile, record.source);
    }
  }

  /**
   * Fallback insight if AI unavailable
   */
  private generateFallbackInsight(percentile: number, source: string): string {
    if (percentile >= 95) {
      return source === 'Rental'
        ? 'This equipment is significantly more expensive than typical rentals. Consider reviewing duration or exploring alternatives.'
        : 'This purchase price is significantly higher than typical equipment. Consider evaluating alternative models.';
    }

    if (percentile >= 90) {
      return source === 'Rental'
        ? 'This rental cost is above average for this category. Review duration to optimize costs.'
        : 'This purchase price is above average. Evaluate if a lower-cost alternative meets requirements.';
    }

    return 'This equipment has moderate budget impact.';
  }

  /**
   * Calculate portfolio-level insights
   */
  private calculatePortfolioInsight(records: PfaRecord[]): PortfolioInsight {
    const percentiles = records.map(r =>
      this.calculatePercentile(r.cost, r.category, records)
    );

    const highImpactCount = percentiles.filter(p => p >= 90).length;
    const moderateImpactCount = percentiles.filter(p => p >= 50 && p < 90).length;
    const lowImpactCount = percentiles.filter(p => p < 50).length;

    // Calculate total cost (even for masked users, we can use it for % calculations)
    const totalCost = records.reduce((sum, r) => sum + r.cost, 0);
    const highImpactCost = records
      .filter((_, i) => percentiles[i] >= 90)
      .reduce((sum, r) => sum + r.cost, 0);

    const highImpactPct = Math.round((highImpactCost / totalCost) * 100);

    const summary = highImpactCount > 0
      ? `${highImpactCount} high-impact items account for ${highImpactPct}% of total budget`
      : 'All items are within typical budget range';

    return {
      totalItems: records.length,
      highImpactCount,
      moderateImpactCount,
      lowImpactCount,
      summary
    };
  }
}
```

**API Endpoint**:

**File**: `backend/src/controllers/financialMaskingController.ts`

```typescript
import { Request, Response } from 'express';
import { FinancialMaskingService } from '../services/ai/FinancialMaskingService';
import { PrismaClient } from '@prisma/client';

const maskingService = new FinancialMaskingService();
const prisma = new PrismaClient();

export const getMaskedPfaRecords = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.query;
    const user = (req as any).user; // From auth middleware

    if (!organizationId) {
      return res.status(400).json({ error: 'Missing organizationId' });
    }

    // Fetch user capabilities
    const userOrg = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: organizationId as string
        }
      },
      include: { role: true }
    });

    if (!userOrg) {
      return res.status(403).json({ error: 'Access denied to this organization' });
    }

    const capabilities = {
      ...userOrg.role?.defaultCapabilities,
      ...userOrg.capabilityOverrides
    } as { viewFinancialDetails: boolean };

    // Fetch PFA records
    const records = await prisma.pfaRecord.findMany({
      where: { organizationId: organizationId as string }
    });

    // Translate to masked records (if needed)
    const result = await maskingService.translateFinancialData({
      userId: user.id,
      organizationId: organizationId as string,
      records,
      userCapabilities: capabilities
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('[getMaskedPfaRecords] Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch PFA records',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
```

---

### Frontend Components

**File**: `components/FinancialImpactBadge.tsx`

```typescript
import React from 'react';
import { Badge, Tooltip } from '@nextui-org/react';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface FinancialImpactBadgeProps {
  impactLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  percentile: number;
  relativeComparison: string;
  impactDescription: string;
  aiInsight?: string;
}

export const FinancialImpactBadge: React.FC<FinancialImpactBadgeProps> = ({
  impactLevel,
  percentile,
  relativeComparison,
  impactDescription,
  aiInsight
}) => {
  const getBadgeConfig = () => {
    switch (impactLevel) {
      case 'CRITICAL':
        return {
          color: 'error' as const,
          icon: <AlertCircle size={14} />,
          label: '🚨 Critical Impact'
        };
      case 'HIGH':
        return {
          color: 'warning' as const,
          icon: <AlertTriangle size={14} />,
          label: '⚠️ High Budget Impact'
        };
      case 'MODERATE':
        return {
          color: 'primary' as const,
          icon: <Info size={14} />,
          label: 'Moderate Impact'
        };
      case 'LOW':
        return {
          color: 'success' as const,
          icon: <CheckCircle size={14} />,
          label: '✅ Within Budget'
        };
    }
  };

  const { color, icon, label } = getBadgeConfig();

  const tooltipContent = (
    <div className="max-w-sm space-y-2 p-2">
      <div>
        <p className="text-xs font-semibold">Budget Impact Analysis</p>
      </div>

      <div className="space-y-1">
        <p className="text-xs">
          <strong>Percentile:</strong> {percentile}th ({impactDescription})
        </p>
        <p className="text-xs">
          <strong>Comparison:</strong> {relativeComparison}
        </p>
      </div>

      {aiInsight && (
        <div className="border-t pt-2 mt-2">
          <p className="text-xs text-gray-600">
            <strong>💡 Recommendation:</strong>
          </p>
          <p className="text-xs text-gray-700">{aiInsight}</p>
        </div>
      )}
    </div>
  );

  return (
    <Tooltip content={tooltipContent} placement="top">
      <Badge color={color} variant="flat" className="cursor-help">
        <span className="flex items-center space-x-1">
          {icon}
          <span className="text-xs">{label}</span>
        </span>
      </Badge>
    </Tooltip>
  );
};
```

**File**: `components/MaskedCostField.tsx`

```typescript
import React from 'react';
import { FinancialImpactBadge } from './FinancialImpactBadge';

interface MaskedCostFieldProps {
  cost: string | number; // "***masked***" or actual number
  impactLevel?: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  percentile?: number;
  relativeComparison?: string;
  impactDescription?: string;
  aiInsight?: string;
}

export const MaskedCostField: React.FC<MaskedCostFieldProps> = ({
  cost,
  impactLevel,
  percentile,
  relativeComparison,
  impactDescription,
  aiInsight
}) => {
  const isMasked = cost === '***masked***';

  if (!isMasked) {
    // User has viewFinancialDetails capability, show actual cost
    return (
      <div className="space-y-1">
        <p className="text-sm font-semibold">
          ${typeof cost === 'number' ? cost.toLocaleString() : cost}
        </p>
      </div>
    );
  }

  // User lacks viewFinancialDetails, show masked value with relative indicators
  return (
    <div className="space-y-2">
      {impactLevel && percentile !== undefined && relativeComparison && impactDescription && (
        <FinancialImpactBadge
          impactLevel={impactLevel}
          percentile={percentile}
          relativeComparison={relativeComparison}
          impactDescription={impactDescription}
          aiInsight={aiInsight}
        />
      )}

      <div className="space-y-1">
        <p className="text-sm text-gray-500">Cost: ***masked***</p>
        {impactDescription && (
          <p className="text-xs text-gray-600">Impact: {impactDescription}</p>
        )}
        {relativeComparison && (
          <p className="text-xs text-gray-600">Comparison: {relativeComparison}</p>
        )}
      </div>

      {aiInsight && (
        <div className="bg-blue-50 p-2 rounded-lg">
          <p className="text-xs text-blue-900">
            💡 {aiInsight}
          </p>
        </div>
      )}
    </div>
  );
};
```

**Update Timeline Component**:

**File**: `components/Timeline.tsx` (Update bar rendering)

```typescript
// Import MaskedCostField
import { MaskedCostField } from './MaskedCostField';

// Update timeline bar tooltip
const renderBarTooltip = (record: PfaRecord) => {
  return (
    <div className="p-2 space-y-2">
      <p className="text-sm font-semibold">{record.description}</p>
      <p className="text-xs text-gray-600">{record.area} | {record.category}</p>

      <MaskedCostField
        cost={record.cost}
        impactLevel={record.impactLevel}
        percentile={record.percentile}
        relativeComparison={record.relativeComparison}
        impactDescription={record.impactDescription}
        aiInsight={record.aiInsight}
      />

      <p className="text-xs text-gray-500">
        Duration: {record.duration} days
      </p>
    </div>
  );
};
```

---

## AI ENFORCEMENT (🚨 CRITICAL)

### Security Rules

**Absolute Costs MUST NEVER Be Exposed**:
```typescript
// ❌ WRONG - Exposes cost in AI insight
aiInsight: "This $450,000 crane is expensive. Consider $140,000 alternative."

// ✅ CORRECT - Uses relative indicators only
aiInsight: "This equipment is 3.2x average cost. Consider standard model alternative."
```

**Bypass Attempt Detection**:
```typescript
// Log attempts to access /api/pfa/records?includeFinancials=true
if (req.query.includeFinancials === 'true' && !userCapabilities.viewFinancialDetails) {
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      organizationId: user.organizationId,
      action: 'financial_access_attempt',
      resourceType: 'PfaRecord',
      metadata: { path: req.path, query: req.query, ip: req.ip }
    }
  });

  return res.status(403).json({ error: 'FINANCIAL_ACCESS_DENIED' });
}
```

**AI Prompt Validation**:
```typescript
// Ensure AI prompt never includes absolute costs
const validateAiPrompt = (prompt: string): boolean => {
  // Check for dollar signs or numeric values that look like costs
  const costPattern = /\$[\d,]+|\d{4,}/g; // Matches "$450,000" or "450000"
  const matches = prompt.match(costPattern);

  if (matches && matches.length > 0) {
    console.error('[FinancialMasking] AI prompt contains absolute costs:', matches);
    return false;
  }

  return true;
};
```

---

## UX ENFORCEMENT (🚨 CRITICAL)

### Latency Budgets

| Action | Target | Max Acceptable | UX Fallback |
|--------|--------|----------------|-------------|
| **Percentile Calculation** | <50ms | 100ms | Client-side cache |
| **AI Insight Generation** | <500ms | 1000ms | Rule-based fallback |
| **Masked Records API** | <300ms | 800ms | Skeleton screen |

### Loading States

**Timeline Bar Loading**:
```tsx
{loading ? (
  <Skeleton className="h-8 w-full" />
) : (
  <MaskedCostField cost={record.cost} {...record} />
)}
```

### Error States

**AI Service Down**:
```tsx
<MaskedCostField
  cost="***masked***"
  impactLevel="MODERATE"
  percentile={70}
  relativeComparison="Above average"
  impactDescription="Moderate budget impact"
  aiInsight="Unable to generate recommendation. Contact administrator."
/>
```

---

## YOUR MISSION

Implement Financial Data Masking in **7 steps**:

### Step 1: Backend AI Service (5 hours)
- Create `FinancialMaskingService.ts`
- Implement percentile calculation
- Implement AI insight generation
- Add LRU cache (5-minute TTL)

### Step 2: Backend API Endpoint (2 hours)
- Create `getMaskedPfaRecords` endpoint
- Add bypass attempt detection
- Add response sanitization

### Step 3: Frontend Components (4 hours)
- Create `FinancialImpactBadge.tsx`
- Create `MaskedCostField.tsx`
- Update `Timeline.tsx` to use masked fields

### Step 4: Testing (3 hours)
- Test percentile calculation accuracy
- Test AI insight generation
- Test bypass attempt detection
- Test cache behavior

### Step 5: Documentation (1 hour)
- Update API reference
- Add component docs
- Add usage examples

---

## DELIVERABLES

1. `backend/src/services/ai/FinancialMaskingService.ts` (400+ lines)
2. `backend/src/controllers/financialMaskingController.ts` (80+ lines)
3. `components/FinancialImpactBadge.tsx` (100+ lines)
4. `components/MaskedCostField.tsx` (80+ lines)
5. `backend/tests/integration/financialMasking.test.ts` (250+ lines)

---

**END OF PROMPT BUNDLE**

Total Lines: ~1,520 lines

---

# Phase 7, Tasks 7.3-7.5: UX Intelligence Features (Consolidated)

**Agent**: @ai-systems-architect + @ux-technologist
**Estimated Duration**: 6 days total (2 days per task)
**Phase**: 7 (UX Intelligence)
**Dependencies**: Phase 4 Complete (Frontend Permission Enforcement)
**Status**: Ready to Execute

---

## OVERVIEW

This document contains **3 complete prompt bundles** for the remaining UX Intelligence features:

1. **Task 7.3**: Semantic Audit Search (AI Use Case 18)
2. **Task 7.4**: Role Drift Detection (AI Use Case 19)
3. **Task 7.5**: Behavioral Quiet Mode (AI Use Case 20)

Each task follows the same structure as Tasks 7.1-7.2 (600-1500 lines per bundle).

---

# TASK 7.3: SEMANTIC AUDIT SEARCH (AI USE CASE 18)

**Agent**: @ai-systems-architect
**Duration**: 2 days

## SYSTEM CONTEXT

**The Problem**: Admins need to query audit logs but must use complex SQL filters. Natural language queries like "Who changed crane duration last week?" are not supported.

**The Solution**: AI-powered semantic search that:
- Parses natural language queries ("Who modified PFA records yesterday?")
- Translates to SQL filters (resourceType = 'PfaRecord', timestamp > '2025-11-25')
- Understands context ("they" refers to users from previous query)
- Correlates with external data (weather events, project milestones)

**Business Value**:
- **80% faster audit investigations** (2 minutes vs. 10 minutes)
- **Non-technical users can audit** (no SQL knowledge required)
- **Complex multi-turn queries** ("Why did they do it?" remembers context)

---

## TECHNICAL SPECIFICATION

### Backend AI Service

**File**: `backend/src/services/ai/SemanticAuditSearchService.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LRUCache } from 'lru-cache';

interface SemanticSearchParams {
  query: string; // Natural language query
  userId: string;
  organizationId: string;
  context?: string; // Previous query ID (for multi-turn)
}

interface ParsedQuery {
  filters: {
    resourceType?: 'User' | 'Organization' | 'PfaRecord' | 'ApiConfiguration';
    action?: string[]; // ['pfa:update', 'permission:grant']
    userId?: string[];
    timeRange?: { start: string; end: string };
    changedFields?: string[]; // ['forecastEnd', 'forecastStart']
    category?: string[]; // ['Cranes', 'Generators']
    booleanOperator?: 'AND' | 'OR';
  };
}

interface SearchResult {
  queryId: string; // For multi-turn context
  parsedQuery: ParsedQuery;
  naturalLanguageSummary: string; // "John Doe modified 12 crane rentals yesterday"
  auditLogs: any[]; // Actual audit log results
  relatedEvents: any[]; // External correlations (weather, milestones)
  aiInsight: string; // "These changes correlate with heavy rain on Nov 25"
  confidence: number; // 0-1
  clarificationNeeded: boolean;
  suggestions?: string[]; // If query is ambiguous
}

export class SemanticAuditSearchService {
  private prisma: PrismaClient;
  private genAI: GoogleGenerativeAI;
  private queryCache: LRUCache<string, ParsedQuery>;
  private contextStore: Map<string, { query: string; results: any[] }>; // Multi-turn context

  constructor() {
    this.prisma = new PrismaClient();
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
    this.queryCache = new LRUCache({ max: 100, ttl: 1000 * 60 * 5 }); // 5 min cache
    this.contextStore = new Map();
  }

  /**
   * Search audit logs using natural language query
   */
  async semanticAuditSearch(params: SemanticSearchParams): Promise<SearchResult> {
    const { query, userId, organizationId, context } = params;

    // Check if query is too vague
    if (this.isQueryAmbiguous(query)) {
      return {
        queryId: this.generateQueryId(),
        parsedQuery: { filters: {} },
        naturalLanguageSummary: '',
        auditLogs: [],
        relatedEvents: [],
        aiInsight: '',
        confidence: 0,
        clarificationNeeded: true,
        suggestions: [
          'What type of changes are you looking for? (PFA records, users, settings)',
          'What time period? (today, yesterday, last week)',
          'Which users or categories?'
        ]
      };
    }

    // Parse natural language query using AI
    const parsedQuery = await this.parseQuery(query, context);

    // Execute database query
    const auditLogs = await this.executeQuery(parsedQuery, organizationId);

    // Correlate with external events (optional)
    const relatedEvents = await this.correlateExternalEvents(parsedQuery, auditLogs);

    // Generate natural language summary
    const naturalLanguageSummary = await this.generateSummary(query, auditLogs);

    // Generate AI insight
    const aiInsight = await this.generateInsight(auditLogs, relatedEvents);

    // Store context for multi-turn queries
    const queryId = this.generateQueryId();
    this.contextStore.set(queryId, { query, results: auditLogs });

    return {
      queryId,
      parsedQuery,
      naturalLanguageSummary,
      auditLogs,
      relatedEvents,
      aiInsight,
      confidence: 0.9,
      clarificationNeeded: false
    };
  }

  /**
   * Parse natural language query using AI
   */
  private async parseQuery(query: string, contextId?: string): Promise<ParsedQuery> {
    // Check cache
    const cacheKey = `${query}:${contextId || 'no-context'}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached) return cached;

    // Get previous context if multi-turn query
    let previousContext = '';
    if (contextId) {
      const ctx = this.contextStore.get(contextId);
      if (ctx) {
        previousContext = `Previous query: "${ctx.query}"\nResults: ${ctx.results.length} audit logs`;
      }
    }

    const prompt = `
You are a query parser for construction equipment audit logs.

${previousContext ? `Context from previous query:\n${previousContext}\n\n` : ''}

User Query: "${query}"

Database Schema:
- resourceType: 'User' | 'Organization' | 'PfaRecord' | 'ApiConfiguration'
- action: string (e.g., 'pfa:update', 'permission:grant', 'user:suspend')
- userId: string
- timestamp: ISO 8601 date
- metadata: JSON (contains changedFields, category, etc.)

Instructions:
1. Parse the user query into database filters
2. Detect time references (today, yesterday, last week, November storm)
3. Understand synonyms (modified = changed = updated, disabled = suspended)
4. Extract entities (users, categories, fields changed)
5. If query mentions "they" or "it", infer from previous context

Output Format (JSON):
{
  "filters": {
    "resourceType": "PfaRecord",
    "action": ["pfa:update"],
    "userId": ["user-123"],
    "timeRange": { "start": "2025-11-19T00:00:00Z", "end": "2025-11-26T23:59:59Z" },
    "changedFields": ["forecastEnd"],
    "category": ["Cranes"],
    "booleanOperator": "AND"
  }
}
`;

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI did not return valid JSON');

      const parsed = JSON.parse(jsonMatch[0]);

      // Cache result
      this.queryCache.set(cacheKey, parsed);

      return parsed;
    } catch (error) {
      console.error('[SemanticAuditSearch] Query parsing failed:', error);

      // Fallback: Simple keyword extraction
      return this.fallbackQueryParser(query);
    }
  }

  /**
   * Execute parsed query against database
   */
  private async executeQuery(parsedQuery: ParsedQuery, organizationId: string): Promise<any[]> {
    const { filters } = parsedQuery;

    const where: any = { organizationId };

    if (filters.resourceType) {
      where.resourceType = filters.resourceType;
    }

    if (filters.action && filters.action.length > 0) {
      where.action = { in: filters.action };
    }

    if (filters.userId && filters.userId.length > 0) {
      where.userId = { in: filters.userId };
    }

    if (filters.timeRange) {
      where.timestamp = {
        gte: new Date(filters.timeRange.start),
        lte: new Date(filters.timeRange.end)
      };
    }

    if (filters.changedFields && filters.changedFields.length > 0) {
      // Use JSON contains filter
      where.metadata = {
        path: ['changedFields'],
        array_contains: filters.changedFields
      };
    }

    return await this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 100 // Limit results
    });
  }

  /**
   * Correlate audit logs with external events (weather, milestones)
   */
  private async correlateExternalEvents(
    parsedQuery: ParsedQuery,
    auditLogs: any[]
  ): Promise<any[]> {
    // Placeholder: In production, query external APIs (weather, project milestones)
    const relatedEvents: any[] = [];

    // Example: Detect "November storm" in query
    if (parsedQuery.filters.timeRange) {
      const start = new Date(parsedQuery.filters.timeRange.start);
      if (start >= new Date('2025-11-20') && start <= new Date('2025-11-25')) {
        relatedEvents.push({
          type: 'weather_event',
          date: '2025-11-22',
          description: 'Heavy rain (3 inches), wind gusts 45 mph'
        });
      }
    }

    return relatedEvents;
  }

  /**
   * Generate natural language summary
   */
  private async generateSummary(query: string, auditLogs: any[]): Promise<string> {
    if (auditLogs.length === 0) {
      return 'No audit logs found matching your query.';
    }

    // Group by user
    const userCounts = auditLogs.reduce((acc, log) => {
      acc[log.userId] = (acc[log.userId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topUser = Object.entries(userCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))[0];

    return `${topUser[0]} made ${topUser[1]} changes matching your query. ${auditLogs.length} total audit logs found.`;
  }

  /**
   * Generate AI insight
   */
  private async generateInsight(auditLogs: any[], relatedEvents: any[]): Promise<string> {
    if (relatedEvents.length > 0) {
      const weatherEvent = relatedEvents.find(e => e.type === 'weather_event');
      if (weatherEvent) {
        return `These changes correlate with ${weatherEvent.description} on ${weatherEvent.date}.`;
      }
    }

    return '';
  }

  /**
   * Fallback query parser (rule-based)
   */
  private fallbackQueryParser(query: string): ParsedQuery {
    const filters: any = {};

    // Detect resource type
    if (query.match(/\b(user|users)\b/i)) filters.resourceType = 'User';
    if (query.match(/\b(pfa|record|records)\b/i)) filters.resourceType = 'PfaRecord';
    if (query.match(/\b(org|organization)\b/i)) filters.resourceType = 'Organization';

    // Detect action
    if (query.match(/\b(modified|changed|updated)\b/i)) filters.action = ['pfa:update'];
    if (query.match(/\b(suspended|disabled)\b/i)) filters.action = ['user:suspend'];
    if (query.match(/\b(permission|granted)\b/i)) filters.action = ['permission:grant'];

    // Detect time range
    const now = new Date();
    if (query.match(/\b(today)\b/i)) {
      filters.timeRange = {
        start: new Date(now.setHours(0, 0, 0, 0)).toISOString(),
        end: new Date(now.setHours(23, 59, 59, 999)).toISOString()
      };
    } else if (query.match(/\b(yesterday)\b/i)) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      filters.timeRange = {
        start: new Date(yesterday.setHours(0, 0, 0, 0)).toISOString(),
        end: new Date(yesterday.setHours(23, 59, 59, 999)).toISOString()
      };
    } else if (query.match(/\b(last week)\b/i)) {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filters.timeRange = {
        start: weekAgo.toISOString(),
        end: now.toISOString()
      };
    }

    return { filters };
  }

  /**
   * Check if query is too ambiguous
   */
  private isQueryAmbiguous(query: string): boolean {
    const vague = ['show me', 'changes', 'stuff', 'things'];
    return vague.some(v => query.toLowerCase() === v);
  }

  /**
   * Generate unique query ID
   */
  private generateQueryId(): string {
    return `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### Frontend Component

**File**: `components/admin/SemanticAuditSearch.tsx`

```typescript
import React, { useState } from 'react';
import { Input, Button, Card, Spinner } from '@nextui-org/react';
import { Search } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

export const SemanticAuditSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await apiClient.post('/api/audit/semantic-search', {
        query,
        userId: currentUser.id,
        organizationId: currentUser.organizationId
      });

      setResults(response.data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <Input
          placeholder="Ask a question... (e.g., Who modified crane duration last week?)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button auto onClick={handleSearch} disabled={loading}>
          {loading ? <Spinner size="sm" /> : <Search size={18} />}
        </Button>
      </div>

      {results && (
        <Card>
          <Card.Header>
            <p className="text-sm font-semibold">{results.naturalLanguageSummary}</p>
          </Card.Header>
          <Card.Body>
            {results.auditLogs.map((log: any) => (
              <div key={log.id} className="border-b py-2">
                <p className="text-xs text-gray-600">{log.action}</p>
                <p className="text-xs">{new Date(log.timestamp).toLocaleString()}</p>
              </div>
            ))}
          </Card.Body>
        </Card>
      )}
    </div>
  );
};
```

---

## YOUR MISSION (Task 7.3)

**7 Steps**:

1. **Backend Service** (5 hours): Create `SemanticAuditSearchService.ts`
2. **API Endpoint** (2 hours): Create `/api/audit/semantic-search`
3. **Frontend Component** (4 hours): Create `SemanticAuditSearch.tsx`
4. **Multi-Turn Context** (2 hours): Implement context store for follow-up queries
5. **External Correlation** (2 hours): Add weather/milestone correlation
6. **Testing** (3 hours): Test query parsing, DB execution, multi-turn
7. **Documentation** (1 hour): Update API docs

**Success Criteria**:
- ✅ AI parses 90%+ of natural language queries correctly
- ✅ Multi-turn queries remember context ("Why did they do it?")
- ✅ Query execution completes in <2 seconds
- ✅ External event correlation works (weather, milestones)

---

# TASK 7.4: ROLE DRIFT DETECTION (AI USE CASE 19)

**Agent**: @ai-systems-architect
**Duration**: 2 days

## SYSTEM CONTEXT

**The Problem**: Over time, users accumulate custom capability overrides. When 5+ users have identical overrides, it signals the need for a new role template.

**The Solution**: AI analyzes user-role-capability patterns weekly and alerts admins:
- "5 Field Engineers have identical overrides (canManageUsers, canManageSettings, viewFinancialDetails)"
- "Suggest creating 'Senior Field Engineer' role"
- "One-click migration: Move 5 users to new role, remove overrides"

**Business Value**:
- **Cleaner permission model** (fewer custom overrides)
- **Faster user onboarding** (assign role instead of 10 individual capabilities)
- **Audit compliance** (role-based > individual overrides)

---

## TECHNICAL SPECIFICATION

### Backend AI Service

**File**: `backend/src/services/ai/RoleDriftDetectionService.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface DriftPattern {
  id: string;
  driftType: 'CONSISTENT_OVERRIDES' | 'EXCESSIVE_OVERRIDES' | 'ROLE_MISMATCH';
  baseRole: string; // 'Field Engineer'
  commonOverrides: Record<string, boolean>; // { canManageUsers: true, ... }
  affectedUsers: string[]; // User IDs
  frequency: string; // "5 out of 12 Field Engineers (42%)"
  suggestedNewRole: {
    name: string; // "Senior Field Engineer"
    inheritsFrom: string; // "Field Engineer"
    additionalCapabilities: Record<string, boolean>;
  };
}

interface DriftDetectionResult {
  driftDetected: boolean;
  patterns: DriftPattern[];
  recommendations: {
    patternId: string;
    action: 'CREATE_NEW_ROLE' | 'NORMALIZE_OVERRIDES' | 'REVIEW_MANUALLY';
    impact: string; // "Affects 5 users, removes 15 custom overrides"
    confidence: number;
  }[];
}

export class RoleDriftDetectionService {
  private prisma: PrismaClient;
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.prisma = new PrismaClient();
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  }

  /**
   * Detect role drift patterns across organization
   */
  async detectRoleDrift(params: { organizationId: string }): Promise<DriftDetectionResult> {
    const { organizationId } = params;

    // Fetch all user-org relationships with overrides
    const userOrgs = await this.prisma.userOrganization.findMany({
      where: { organizationId },
      include: { role: true, user: true }
    });

    // Group by role
    const roleGroups = userOrgs.reduce((acc, uo) => {
      const roleName = uo.role?.name || 'No Role';
      if (!acc[roleName]) acc[roleName] = [];
      acc[roleName].push(uo);
      return acc;
    }, {} as Record<string, any[]>);

    // Detect drift patterns
    const patterns: DriftPattern[] = [];

    for (const [roleName, users] of Object.entries(roleGroups)) {
      // Find users with overrides
      const usersWithOverrides = users.filter(u =>
        Object.keys(u.capabilityOverrides || {}).length > 0
      );

      if (usersWithOverrides.length < 3) continue; // Need at least 3 for pattern

      // Find common overrides
      const overrideCombinations = usersWithOverrides.map(u => u.capabilityOverrides);
      const commonPattern = this.findCommonOverrides(overrideCombinations);

      if (commonPattern && Object.keys(commonPattern).length >= 2) {
        // Found drift pattern
        const affectedUserIds = usersWithOverrides
          .filter(u => this.hasOverrides(u.capabilityOverrides, commonPattern))
          .map(u => u.userId);

        const frequency = `${affectedUserIds.length} out of ${users.length} ${roleName}s (${Math.round((affectedUserIds.length / users.length) * 100)}%)`;

        patterns.push({
          id: `pattern-${Date.now()}-${roleName}`,
          driftType: 'CONSISTENT_OVERRIDES',
          baseRole: roleName,
          commonOverrides: commonPattern,
          affectedUsers: affectedUserIds,
          frequency,
          suggestedNewRole: {
            name: `Senior ${roleName}`,
            inheritsFrom: roleName,
            additionalCapabilities: commonPattern
          }
        });
      }
    }

    // Generate recommendations
    const recommendations = patterns.map(pattern => ({
      patternId: pattern.id,
      action: 'CREATE_NEW_ROLE' as const,
      impact: `Affects ${pattern.affectedUsers.length} users, removes ${Object.keys(pattern.commonOverrides).length * pattern.affectedUsers.length} custom overrides`,
      confidence: 0.9
    }));

    return {
      driftDetected: patterns.length > 0,
      patterns,
      recommendations
    };
  }

  /**
   * Find common overrides across users
   */
  private findCommonOverrides(overrides: any[]): Record<string, boolean> | null {
    if (overrides.length < 3) return null;

    // Count frequency of each override
    const overrideCounts: Record<string, number> = {};

    overrides.forEach(override => {
      Object.keys(override).forEach(key => {
        overrideCounts[key] = (overrideCounts[key] || 0) + 1;
      });
    });

    // Find overrides present in 60%+ of users
    const threshold = Math.ceil(overrides.length * 0.6);
    const commonOverrides: Record<string, boolean> = {};

    Object.entries(overrideCounts).forEach(([key, count]) => {
      if (count >= threshold) {
        // Use most common value (true or false)
        const values = overrides.map(o => o[key]).filter(v => v !== undefined);
        const trueCount = values.filter(v => v === true).length;
        commonOverrides[key] = trueCount > values.length / 2;
      }
    });

    return Object.keys(commonOverrides).length >= 2 ? commonOverrides : null;
  }

  /**
   * Check if user has specific overrides
   */
  private hasOverrides(
    userOverrides: any,
    targetOverrides: Record<string, boolean>
  ): boolean {
    return Object.entries(targetOverrides).every(
      ([key, value]) => userOverrides[key] === value
    );
  }

  /**
   * Apply role refactor (create new role, migrate users)
   */
  async applyRoleRefactor(params: {
    patternId: string;
    approve: boolean;
    adminUserId: string;
  }): Promise<{
    newRoleCreated: boolean;
    usersMigrated: number;
    overridesRemoved: number;
    rollbackAvailable: boolean;
  }> {
    // Implementation: Create new role, migrate users, log for rollback
    // (See TEST_PLAN.md lines 1529-1543 for details)

    return {
      newRoleCreated: true,
      usersMigrated: 5,
      overridesRemoved: 15,
      rollbackAvailable: true
    };
  }
}
```

### Frontend Component

**File**: `components/admin/RoleDriftAlerts.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { Card, Button, Badge } from '@nextui-org/react';
import { apiClient } from '@/services/apiClient';

export const RoleDriftAlerts: React.FC = () => {
  const [driftResult, setDriftResult] = useState<any>(null);

  useEffect(() => {
    const fetchDrift = async () => {
      const response = await apiClient.post('/api/roles/detect-drift', {
        organizationId: currentUser.organizationId
      });
      setDriftResult(response.data);
    };

    fetchDrift();
  }, []);

  const handleApplyRefactor = async (patternId: string) => {
    const confirmed = confirm('Create new role and migrate users?');
    if (!confirmed) return;

    await apiClient.post('/api/roles/apply-refactor', {
      patternId,
      approve: true,
      adminUserId: currentUser.id
    });

    alert('Role refactor complete!');
  };

  if (!driftResult || !driftResult.driftDetected) {
    return <p className="text-sm text-gray-600">No role drift detected.</p>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">⚠️ Role Drift Detected</h3>

      {driftResult.patterns.map((pattern: any) => (
        <Card key={pattern.id}>
          <Card.Header>
            <div className="flex justify-between items-center w-full">
              <p className="font-semibold">{pattern.frequency}</p>
              <Badge color="warning">Drift Detected</Badge>
            </div>
          </Card.Header>
          <Card.Body>
            <p className="text-sm mb-2">
              <strong>Base Role:</strong> {pattern.baseRole}
            </p>
            <p className="text-sm mb-2">
              <strong>Common Overrides:</strong>
            </p>
            <ul className="list-disc list-inside text-xs">
              {Object.entries(pattern.commonOverrides).map(([key, value]) => (
                <li key={key}>{key}: {value ? '✅' : '❌'}</li>
              ))}
            </ul>

            <p className="text-sm mt-4">
              <strong>Suggested New Role:</strong> {pattern.suggestedNewRole.name}
            </p>
          </Card.Body>
          <Card.Footer>
            <Button auto size="sm" onClick={() => handleApplyRefactor(pattern.id)}>
              Apply Refactor
            </Button>
          </Card.Footer>
        </Card>
      ))}
    </div>
  );
};
```

---

## YOUR MISSION (Task 7.4)

**7 Steps**:

1. **Backend Service** (4 hours): Create `RoleDriftDetectionService.ts`
2. **Common Override Detection** (3 hours): Implement `findCommonOverrides()`
3. **API Endpoints** (2 hours): `/detect-drift`, `/apply-refactor`
4. **Frontend Component** (3 hours): Create `RoleDriftAlerts.tsx`
5. **Rollback System** (2 hours): Store refactor history for 7-day rollback
6. **Testing** (3 hours): Test drift detection, refactor, rollback
7. **Documentation** (1 hour): Update admin guide

**Success Criteria**:
- ✅ Detects drift when 3+ users have 60%+ identical overrides
- ✅ One-click refactor creates new role and migrates users
- ✅ Rollback works within 7 days
- ✅ False positive rate <10%

---

# TASK 7.5: BEHAVIORAL QUIET MODE (AI USE Case 20)

**Agent**: @ux-technologist
**Duration**: 2 days

## SYSTEM CONTEXT

**The Problem**: Users receive 25+ notifications/day at random times, disrupting focus. Urgent alerts interrupt deep work, routine notifications during meetings.

**The Solution**: AI learns user engagement patterns over 4 months:
- Peak attention hours: 14:00-16:00 (user clicks notifications within 15 min)
- Quiet hours: 08:00-12:00 (user ignores notifications for 4+ hours)
- Urgent alerts: Send immediately via Slack
- Routine notifications: Defer to 14:00, batch into digest

**Business Value**:
- **30% reduction in interruptions** (8 fewer notifications during focus time)
- **Higher engagement rate** (65% click-through vs. 40% baseline)
- **User satisfaction** (notifications feel helpful, not spammy)

---

## TECHNICAL SPECIFICATION

### Backend AI Service

**File**: `backend/src/services/ai/NotificationTimingService.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface EngagementProfile {
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
    recommendation: string; // "Reduce routine notifications by 60%"
  };
  confidence: number; // How confident are we in this profile? (0-1)
}

interface RoutingDecision {
  action: 'SEND_NOW' | 'DEFER' | 'BATCH_DIGEST';
  deferUntil?: string; // ISO 8601 timestamp
  channel: 'slack' | 'email' | 'in_app';
  reasoning: string; // "User typically engages with urgent notifications in Slack within 15 min"
}

export class NotificationTimingService {
  private prisma: PrismaClient;
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.prisma = new PrismaClient();
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  }

  /**
   * Learn user notification preferences from engagement data
   */
  async learnNotificationPreferences(params: {
    userId: string;
  }): Promise<{ engagementProfile: EngagementProfile }> {
    const { userId } = params;

    // Fetch 4 months of notification engagement data
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);

    const notifications = await this.prisma.notification.findMany({
      where: {
        userId,
        sentAt: { gte: fourMonthsAgo }
      },
      orderBy: { sentAt: 'desc' }
    });

    // Analyze engagement patterns
    const hourlyEngagement = this.analyzeHourlyEngagement(notifications);
    const peakHours = this.findPeakHours(hourlyEngagement);
    const quietHours = this.findQuietHours(hourlyEngagement);

    // Analyze channel preferences
    const preferredChannels = this.analyzeChannelPreferences(notifications);

    // Detect notification saturation
    const saturation = this.detectSaturation(notifications);

    return {
      engagementProfile: {
        userId,
        peakAttentionHours: peakHours,
        quietHours: quietHours,
        preferredChannels,
        notificationSaturation: saturation,
        confidence: 0.85
      }
    };
  }

  /**
   * Route notification based on user behavior patterns
   */
  async routeNotification(params: {
    userId: string;
    notification: { type: string; urgency: 'urgent' | 'routine' };
    timestamp: string;
  }): Promise<{ routingDecision: RoutingDecision }> {
    const { userId, notification, timestamp } = params;

    // Get user engagement profile
    const { engagementProfile } = await this.learnNotificationPreferences({ userId });

    // Urgent notifications: Send immediately
    if (notification.urgency === 'urgent') {
      return {
        routingDecision: {
          action: 'SEND_NOW',
          channel: engagementProfile.preferredChannels.urgent,
          reasoning: 'Urgent notification: Send immediately via preferred channel'
        }
      };
    }

    // Routine notifications: Check if in quiet hours
    const hour = new Date(timestamp).getHours();
    const inQuietHours = engagementProfile.quietHours.some(range => {
      const [start, end] = range.split('-').map(h => parseInt(h.split(':')[0]));
      return hour >= start && hour < end;
    });

    if (inQuietHours) {
      // Defer to peak attention hours
      const peakHour = engagementProfile.peakAttentionHours[0]?.split('-')[0] || '14:00';
      const deferDate = new Date(timestamp);
      deferDate.setHours(parseInt(peakHour.split(':')[0]), 0, 0, 0);

      return {
        routingDecision: {
          action: 'DEFER',
          deferUntil: deferDate.toISOString(),
          channel: engagementProfile.preferredChannels.routine,
          reasoning: `User is in quiet hours (${hour}:00). Defer to peak attention time (${peakHour}).`
        }
      };
    }

    // Not in quiet hours: Send now
    return {
      routingDecision: {
        action: 'SEND_NOW',
        channel: engagementProfile.preferredChannels.routine,
        reasoning: 'Outside quiet hours, send immediately'
      }
    };
  }

  /**
   * Analyze hourly engagement (click-through rate by hour)
   */
  private analyzeHourlyEngagement(notifications: any[]): Record<number, number> {
    const hourlyData: Record<number, { sent: number; clicked: number }> = {};

    notifications.forEach(notif => {
      const hour = new Date(notif.sentAt).getHours();
      if (!hourlyData[hour]) hourlyData[hour] = { sent: 0, clicked: 0 };

      hourlyData[hour].sent += 1;
      if (notif.clickedAt) hourlyData[hour].clicked += 1;
    });

    // Calculate click-through rate (CTR) for each hour
    const hourlyCtr: Record<number, number> = {};
    Object.entries(hourlyData).forEach(([hour, data]) => {
      hourlyCtr[parseInt(hour)] = data.clicked / data.sent;
    });

    return hourlyCtr;
  }

  /**
   * Find peak attention hours (top 25% CTR)
   */
  private findPeakHours(hourlyCtr: Record<number, number>): string[] {
    const sorted = Object.entries(hourlyCtr)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6); // Top 6 hours

    return sorted.map(([hour]) => `${hour}:00-${parseInt(hour) + 1}:00`);
  }

  /**
   * Find quiet hours (bottom 25% CTR)
   */
  private findQuietHours(hourlyCtr: Record<number, number>): string[] {
    const sorted = Object.entries(hourlyCtr)
      .sort(([, a], [, b]) => a - b)
      .slice(0, 4); // Bottom 4 hours

    return sorted.map(([hour]) => `${hour}:00-${parseInt(hour) + 1}:00`);
  }

  /**
   * Analyze channel preferences (Slack vs. Email vs. In-App)
   */
  private analyzeChannelPreferences(notifications: any[]): {
    urgent: 'slack' | 'email' | 'in_app';
    routine: 'slack' | 'email' | 'in_app';
  } {
    // Group by urgency and channel
    const urgentChannels = notifications.filter(n => n.urgency === 'urgent');
    const routineChannels = notifications.filter(n => n.urgency === 'routine');

    const getPreferredChannel = (notifs: any[]): 'slack' | 'email' | 'in_app' => {
      const channelEngagement: Record<string, { sent: number; avgResponseTime: number }> = {};

      notifs.forEach(n => {
        if (!channelEngagement[n.channel]) {
          channelEngagement[n.channel] = { sent: 0, avgResponseTime: 0 };
        }

        channelEngagement[n.channel].sent += 1;
        if (n.clickedAt) {
          const responseTime = new Date(n.clickedAt).getTime() - new Date(n.sentAt).getTime();
          channelEngagement[n.channel].avgResponseTime += responseTime;
        }
      });

      // Sort by fastest avg response time
      const sorted = Object.entries(channelEngagement)
        .map(([channel, data]) => ({
          channel,
          avgResponseTime: data.avgResponseTime / data.sent
        }))
        .sort((a, b) => a.avgResponseTime - b.avgResponseTime);

      return sorted[0]?.channel as 'slack' | 'email' | 'in_app' || 'in_app';
    };

    return {
      urgent: getPreferredChannel(urgentChannels),
      routine: getPreferredChannel(routineChannels)
    };
  }

  /**
   * Detect notification saturation (too many notifications)
   */
  private detectSaturation(notifications: any[]): {
    status: 'HEALTHY' | 'MODERATE' | 'OVERLOADED';
    dailyCount: number;
    recommendation: string;
  } {
    // Calculate average daily notifications
    const days = Math.max(1, (Date.now() - new Date(notifications[notifications.length - 1]?.sentAt).getTime()) / (1000 * 60 * 60 * 24));
    const dailyCount = Math.round(notifications.length / days);

    if (dailyCount > 20) {
      return {
        status: 'OVERLOADED',
        dailyCount,
        recommendation: 'Reduce routine notifications by 60%. User is receiving too many notifications.'
      };
    }

    if (dailyCount > 10) {
      return {
        status: 'MODERATE',
        dailyCount,
        recommendation: 'Consider batching routine notifications into a daily digest.'
      };
    }

    return {
      status: 'HEALTHY',
      dailyCount,
      recommendation: 'Notification volume is healthy.'
    };
  }
}
```

### Frontend Component

**File**: `components/settings/NotificationPreferences.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { Card, Switch, Button } from '@nextui-org/react';
import { apiClient } from '@/services/apiClient';

export const NotificationPreferences: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const response = await apiClient.post('/api/notifications/learn-preferences', {
        userId: currentUser.id
      });
      setProfile(response.data.engagementProfile);
    };

    fetchProfile();
  }, []);

  if (!profile) return <p>Loading...</p>;

  return (
    <Card>
      <Card.Header>
        <h3 className="text-lg font-semibold">🔔 Smart Notification Timing</h3>
      </Card.Header>
      <Card.Body>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold">Peak Attention Hours</p>
            <p className="text-xs text-gray-600">{profile.peakAttentionHours.join(', ')}</p>
          </div>

          <div>
            <p className="text-sm font-semibold">Quiet Hours</p>
            <p className="text-xs text-gray-600">{profile.quietHours.join(', ')}</p>
          </div>

          <div>
            <p className="text-sm font-semibold">Notification Saturation</p>
            <p className="text-xs text-gray-600">
              {profile.notificationSaturation.dailyCount} notifications/day ({profile.notificationSaturation.status})
            </p>
            {profile.notificationSaturation.status !== 'HEALTHY' && (
              <p className="text-xs text-yellow-600 mt-1">
                💡 {profile.notificationSaturation.recommendation}
              </p>
            )}
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};
```

---

## YOUR MISSION (Task 7.5)

**7 Steps**:

1. **Backend Service** (5 hours): Create `NotificationTimingService.ts`
2. **Engagement Analysis** (3 hours): Implement `analyzeHourlyEngagement()`
3. **Routing Logic** (2 hours): Implement `routeNotification()`
4. **API Endpoints** (2 hours): `/learn-preferences`, `/route-notification`
5. **Frontend Component** (3 hours): Create `NotificationPreferences.tsx`
6. **Testing** (3 hours): Test engagement analysis, routing decisions
7. **Documentation** (1 hour): Update user guide

**Success Criteria**:
- ✅ AI learns peak/quiet hours after 4 months of data
- ✅ Routine notifications deferred during quiet hours
- ✅ Urgent notifications sent immediately
- ✅ Notification digest batches 10+ deferred notifications
- ✅ User engagement rate increases by 20%+

---

## DELIVERABLES (All 3 Tasks)

**Task 7.3 (Semantic Audit Search)**:
1. `backend/src/services/ai/SemanticAuditSearchService.ts` (400+ lines)
2. `backend/src/controllers/semanticAuditController.ts` (80+ lines)
3. `components/admin/SemanticAuditSearch.tsx` (150+ lines)
4. `backend/tests/integration/semanticAuditSearch.test.ts` (200+ lines)

**Task 7.4 (Role Drift Detection)**:
1. `backend/src/services/ai/RoleDriftDetectionService.ts` (350+ lines)
2. `backend/src/controllers/roleDriftController.ts` (100+ lines)
3. `components/admin/RoleDriftAlerts.tsx` (120+ lines)
4. `backend/tests/integration/roleDriftDetection.test.ts` (180+ lines)

**Task 7.5 (Behavioral Quiet Mode)**:
1. `backend/src/services/ai/NotificationTimingService.ts` (450+ lines)
2. `backend/src/controllers/notificationTimingController.ts` (90+ lines)
3. `components/settings/NotificationPreferences.tsx` (140+ lines)
4. `backend/tests/integration/notificationTiming.test.ts` (220+ lines)

---

## CONSTRAINTS (All Tasks)

### ❌ Do NOT
1. ❌ Store sensitive data in AI prompts (costs, internal IDs)
2. ❌ Call AI service synchronously on every request (use cache)
3. ❌ Skip fallback logic (AI service may be unavailable)
4. ❌ Ignore performance (AI calls must complete in <2s)

### ✅ Do ENFORCE
1. ✅ Cache AI results (LRU cache, 5-15 min TTL)
2. ✅ Validate AI response schema before using
3. ✅ Use rule-based fallback if AI fails
4. ✅ Log AI errors for debugging

---

## VERIFICATION QUESTIONS (All Tasks)

**Task 7.3 (Semantic Audit Search)**:
1. Does AI parse 90%+ of natural language queries correctly?
2. Do multi-turn queries remember context?
3. Does external event correlation work?
4. Is query execution <2 seconds?

**Task 7.4 (Role Drift Detection)**:
1. Does AI detect drift when 3+ users have 60%+ identical overrides?
2. Does one-click refactor create new role and migrate users?
3. Does rollback work within 7 days?
4. Is false positive rate <10%?

**Task 7.5 (Behavioral Quiet Mode)**:
1. Does AI learn peak/quiet hours after 4 months?
2. Are routine notifications deferred during quiet hours?
3. Are urgent notifications sent immediately?
4. Does notification digest batch 10+ deferred notifications?
5. Does user engagement rate increase by 20%+?

---

**END OF CONSOLIDATED PROMPT BUNDLE**

Total Lines: ~2,800 lines (3 tasks combined)

---

## 💼 Phase 8: BEO Intelligence

**Duration**: 3 days | **Prerequisites**: Phase 6 Complete

---

# Phase 8 Task 8.1: Boardroom Voice Analyst (UC 21) - Complete Prompt Bundle

**Agent Assignment**: `ai-systems-architect`
**Estimated Duration**: 0.5 days
**Status**: Ready for Execution
**Dependencies**: Phase 6 Complete (AI Foundation)

---

## 🎯 Executive Summary

**Mission**: Implement a voice-enabled conversational BI interface that allows BEO executives (CFOs, COOs) to ask natural language questions about portfolio performance and receive intelligent, contextual responses in both voice and text formats.

**Business Value**:
- **Executive Time Savings**: 80% faster than navigating dashboards manually
- **Accessibility**: Voice queries enable hands-free operation during meetings
- **Actionable Insights**: AI identifies root causes and recommends actions
- **Persona Adaptation**: CFO gets financial emphasis, COO gets operational emphasis

**Key Deliverables**:
1. `BeoAnalyticsService.ts` - Portfolio query processing with AI
2. `VoiceAnalyst.tsx` - Voice-enabled frontend component with Web Speech API
3. Voice-to-text + text-to-speech integration
4. Executive persona detection and response adaptation
5. Follow-up question context preservation
6. Sub-3-second query response time

---

## 📋 Context & Requirements

### Use Case 21: Boardroom Voice Analyst

**User Story**:
> As a **CFO** (BEO user with portfolio access),
> I want to **ask natural language questions via voice or text** (e.g., "Which projects are over budget?"),
> so that I can **get instant portfolio insights without navigating complex dashboards** during board meetings.

**Key Features**:

1. **Voice Input** (Web Speech API):
   - Large microphone button with waveform animation during recording
   - Real-time speech-to-text transcription displayed to user
   - Text fallback for accessibility or noisy environments
   - Keyboard shortcut: `Ctrl+M` to activate microphone

2. **Conversational BI**:
   - Natural language query parsing: "Which projects are over budget?"
   - AI analyzes portfolio-wide data across all organizations
   - Responds in conversational tone with executive-level language
   - Example response: "Three of your seven projects are trending over budget this quarter: HOLNG (+$450K), RIO (+$280K), PEMS (+$95K)..."

3. **Voice Output** (Text-to-Speech):
   - Audio playback button for AI responses
   - Optimized for TTS: Avoids "$" symbols, uses "dollars"
   - Concise responses (<500 chars for voice, full details in card)

4. **Executive Persona Adaptation**:
   - Detects user role (CFO vs. COO) from user profile
   - CFO responses emphasize: Budget, variance, financial impact
   - COO responses emphasize: Schedule, delays, operational issues

5. **Follow-up Context**:
   - Preserves conversation context for multi-turn queries
   - User asks: "Which projects are over budget?" → AI responds
   - User follows up: "Tell me more about HOLNG" → AI provides deep dive

6. **Performance**:
   - Query response time: **<3 seconds** (executive experience requirement)
   - Latency budget: 1s backend query + 1s AI processing + 1s UI render

---

## 🛠️ Technical Specifications

### Backend Implementation

**File**: `backend/src/services/ai/BeoAnalyticsService.ts`

**Core Methods**:

```typescript
export class BeoAnalyticsService {
  /**
   * Answer portfolio-level queries with conversational voice interface
   *
   * @param params.userId - User making the query (must have BEO access)
   * @param params.query - Natural language query (e.g., "Which projects are over budget?")
   * @param params.responseFormat - 'conversational' (for voice) or 'structured' (for charts)
   * @param params.context - Optional queryId from previous query for follow-up questions
   *
   * @returns {Object} AI-generated response with narrative, metrics, and breakdown
   */
  async answerPortfolioQuery(params: {
    userId: string;
    query: string;
    responseFormat: 'conversational' | 'structured';
    context?: string; // Previous queryId for follow-up questions
  }): Promise<{
    queryId: string; // For context preservation
    narrative: string; // Conversational summary (2-3 sentences)
    voiceResponse?: string; // TTS-optimized version (<500 chars, no "$")
    executiveSummary: {
      portfolioVariance: string; // e.g., "+$825K"
      projectsAtRisk: number; // Count of over-budget projects
      totalSpend: string; // e.g., "$11.2M"
      organization?: string; // For drill-down queries
    };
    detailedBreakdown: Array<{
      organizationCode: string;
      variance: number;
      variancePercent: number;
      reason: string; // Root cause (e.g., "Weather delays")
      actions?: string[]; // Recommended actions
    }>;
    confidence: number; // 0-1 confidence score for AI response
  }>;

  /**
   * Verify user has BEO portfolio access
   *
   * BEO users must have:
   * - Role: 'admin' or 'beo_viewer'
   * - Permission: 'perm_ViewAllOrgs' capability
   */
  private async verifyBeoAccess(userId: string): Promise<boolean>;

  /**
   * Get portfolio-wide data across all organizations
   *
   * Aggregates:
   * - Total Plan vs. Forecast vs. Actual costs
   * - Variance by organization
   * - Variance by category (cranes, scaffolds, etc.)
   * - Recent audit log activity (for root cause detection)
   */
  private async getPortfolioData(): Promise<PortfolioData>;

  /**
   * Detect executive persona from user profile
   *
   * Checks user.jobTitle or user.role:
   * - CFO, Finance Director → 'cfo' (emphasize financials)
   * - COO, Operations Manager → 'coo' (emphasize schedule)
   * - Default → 'executive' (balanced)
   */
  private detectPersona(userId: string): Promise<'cfo' | 'coo' | 'executive'>;

  /**
   * Generate AI prompt based on persona
   *
   * CFO Prompt Template:
   * "You are a CFO's executive assistant analyzing construction portfolio data.
   *  Focus on budget variance, financial impact, and cost trends.
   *  Query: '{query}'
   *  Portfolio Data: {portfolioData}
   *  Generate a conversational response emphasizing financial metrics."
   *
   * COO Prompt Template:
   * "You are a COO's operations assistant analyzing construction schedules.
   *  Focus on project delays, equipment availability, and resource utilization.
   *  Query: '{query}'
   *  Portfolio Data: {portfolioData}
   *  Generate a conversational response emphasizing operational metrics."
   */
  private generatePrompt(query: string, persona: string, portfolioData: any): string;

  /**
   * Convert text response to TTS-optimized format
   *
   * Transformations:
   * - "$450K" → "four hundred fifty thousand dollars"
   * - "18 cranes" → "eighteen cranes"
   * - "+12%" → "twelve percent increase"
   * - Remove technical jargon
   * - Keep <500 characters for natural speech flow
   */
  private toVoiceResponse(narrative: string): string;
}
```

**Database Schema Requirements**:

```prisma
model AiQueryLog {
  id              String   @id @default(cuid())
  queryId         String   @unique // For context preservation
  userId          String
  query           String
  response        Json     // Full AI response
  persona         String   // 'cfo', 'coo', 'executive'
  confidence      Float
  responseTime    Int      // Milliseconds
  createdAt       DateTime @default(now())

  // Relations
  user            User     @relation(fields: [userId], references: [id])

  @@index([userId, createdAt]) // For recent queries UI
}
```

**API Endpoints**:

```typescript
// POST /api/beo/query
router.post('/query', requirePermission('perm_ViewAllOrgs'), async (req, res) => {
  const { query, responseFormat, context } = req.body;

  const result = await beoAnalyticsService.answerPortfolioQuery({
    userId: req.user!.id,
    query,
    responseFormat: responseFormat || 'conversational',
    context,
  });

  res.json(result);
});

// GET /api/beo/recent-queries
router.get('/recent-queries', requirePermission('perm_ViewAllOrgs'), async (req, res) => {
  const queries = await prisma.aiQueryLog.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  res.json(queries);
});
```

---

### Frontend Implementation

**File**: `components/beo/VoiceAnalyst.tsx`

**Component Structure**:

```tsx
import { Mic, MicOff, Volume2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient';

interface BeoQueryResponse {
  queryId: string;
  narrative: string;
  voiceResponse?: string;
  executiveSummary: {
    portfolioVariance: string;
    projectsAtRisk: number;
    totalSpend: string;
    organization?: string;
  };
  detailedBreakdown: Array<{
    organizationCode: string;
    variance: number;
    variancePercent: number;
    reason: string;
    actions?: string[];
  }>;
  confidence: number;
}

export function VoiceAnalyst() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState<BeoQueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [contextQueryId, setContextQueryId] = useState<string | null>(null);
  const [expandedBreakdown, setExpandedBreakdown] = useState(false);

  // Load recent queries on mount
  useEffect(() => {
    loadRecentQueries();
  }, []);

  // Keyboard shortcut: Ctrl+M to activate microphone
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'm') {
        e.preventDefault();
        startListening();
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  const loadRecentQueries = async () => {
    const queries = await apiClient.getBeoRecentQueries();
    setRecentQueries(queries.map((q: any) => q.query));
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Voice input not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    setListening(true);
    setTranscript('');

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcriptText = event.results[current][0].transcript;
      setTranscript(transcriptText);

      if (event.results[current].isFinal) {
        submitQuery(transcriptText);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
  };

  const stopListening = () => {
    setListening(false);
    // Recognition will auto-stop via onend handler
  };

  const submitQuery = async (query: string) => {
    setLoading(true);
    setListening(false);

    try {
      const result = await apiClient.queryBeoAnalytics({
        query,
        responseFormat: 'conversational',
        context: contextQueryId,
      });

      setResponse(result);
      setContextQueryId(result.queryId); // Preserve context for follow-ups
      setRecentQueries([query, ...recentQueries.slice(0, 9)]); // Add to recent

      // Text-to-speech playback
      if (result.voiceResponse) {
        playVoiceResponse(result.voiceResponse);
      }
    } catch (error) {
      console.error('Query failed:', error);
      alert('Failed to process query. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const playVoiceResponse = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1.0;
    speechSynthesis.speak(utterance);
  };

  return (
    <div className="voice-analyst p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">💼 Executive Dashboard</h1>
        <p className="text-gray-600 mt-1">Ask questions about your portfolio performance</p>
      </div>

      {/* Voice Input Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          🎤 Ask a Question
        </h2>

        {/* Microphone Button */}
        <div className="flex flex-col items-center mb-4">
          <button
            onClick={listening ? stopListening : startListening}
            disabled={loading}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
              listening
                ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                : 'bg-blue-500 hover:bg-blue-600'
            } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {listening ? <MicOff className="w-12 h-12" /> : <Mic className="w-12 h-12" />}
          </button>

          <p className="text-sm text-gray-600 mt-2">
            {listening ? '🔴 Listening...' : 'Tap to speak or type below'}
          </p>
          <p className="text-xs text-gray-500">Keyboard: Ctrl+M</p>
        </div>

        {/* Waveform Animation (when listening) */}
        {listening && (
          <div className="flex items-center justify-center gap-1 mb-4">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-blue-500 rounded animate-waveform"
                style={{
                  height: `${Math.random() * 40 + 10}px`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Live Transcript */}
        {transcript && (
          <div className="bg-blue-50 p-3 rounded mb-4">
            <p className="text-sm text-gray-700">"{transcript}"</p>
          </div>
        )}

        {/* Text Input Fallback */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Type your question..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                submitQuery(e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
          <button
            onClick={(e) => {
              const input = (e.currentTarget.previousSibling as HTMLInputElement);
              if (input.value.trim()) {
                submitQuery(input.value);
                input.value = '';
              }
            }}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            Ask
          </button>
        </div>

        {/* Recent Queries */}
        {recentQueries.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Recent Queries:</p>
            <ul className="space-y-1">
              {recentQueries.slice(0, 3).map((query, i) => (
                <li key={i}>
                  <button
                    onClick={() => submitQuery(query)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    • {query}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Analyzing portfolio data...</p>
        </div>
      )}

      {/* AI Response Card */}
      {response && !loading && (
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Response Header */}
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              🤖 Portfolio Variance Analysis
            </h2>
            <button
              onClick={() => playVoiceResponse(response.voiceResponse || response.narrative)}
              className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
            >
              <Volume2 className="w-4 h-4" />
              Play Audio
            </button>
          </div>

          {/* Narrative Summary */}
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <p className="text-lg text-gray-800 leading-relaxed">{response.narrative}</p>
            {response.confidence < 0.8 && (
              <p className="text-xs text-orange-600 mt-2">
                ⚠️ Confidence: {Math.round(response.confidence * 100)}% - Verify critical decisions
              </p>
            )}
          </div>

          {/* Executive Summary Metrics */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-600 mb-1">Portfolio Variance</h4>
              <p className="text-2xl font-bold text-red-600">
                {response.executiveSummary.portfolioVariance}
              </p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-600 mb-1">Projects at Risk</h4>
              <p className="text-2xl font-bold text-orange-600">
                {response.executiveSummary.projectsAtRisk}
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-600 mb-1">Total Spend</h4>
              <p className="text-2xl font-bold text-blue-600">
                {response.executiveSummary.totalSpend}
              </p>
            </div>
          </div>

          {/* Detailed Breakdown (Collapsible) */}
          <div className="border-t pt-4">
            <button
              onClick={() => setExpandedBreakdown(!expandedBreakdown)}
              className="flex items-center justify-between w-full text-left"
            >
              <h3 className="font-semibold text-gray-900">Detailed Breakdown</h3>
              {expandedBreakdown ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </button>

            {expandedBreakdown && (
              <div className="mt-4 space-y-4">
                {response.detailedBreakdown.map((item, i) => (
                  <div key={i} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">
                        {i + 1}. {item.organizationCode}
                      </h4>
                      <span
                        className={`text-lg font-bold ${
                          item.variance > 0 ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {item.variance > 0 ? '+' : ''}${item.variance.toLocaleString()} (
                        {item.variancePercent > 0 ? '+' : ''}
                        {item.variancePercent}%)
                      </span>
                    </div>

                    <p className="text-sm text-gray-700 mb-2">
                      <span className="font-medium">Driver:</span> {item.reason}
                    </p>

                    {item.actions && item.actions.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-gray-600 mb-1">
                          💡 Recommended Actions:
                        </p>
                        <ul className="space-y-1">
                          {item.actions.map((action, j) => (
                            <li key={j} className="text-xs text-gray-700">
                              • {action}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition">
              📊 Export Report
            </button>
            <button
              onClick={() => {
                setResponse(null);
                setContextQueryId(null);
              }}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
            >
              💬 Ask Follow-up
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**CSS Animations** (add to `globals.css`):

```css
@keyframes waveform {
  0%, 100% { height: 10px; }
  50% { height: 40px; }
}

.animate-waveform {
  animation: waveform 0.8s ease-in-out infinite;
}
```

---

## 🧪 Testing Requirements

### Test Suite Location
**File**: `backend/tests/integration/beoVoiceAnalyst.test.ts`

### Test Scenarios (from TEST_PLAN.md lines 1678-1783)

```typescript
describe('Use Case 21: Boardroom Voice Analyst', () => {
  let beoUser: User;
  let regularUser: User;

  beforeEach(async () => {
    // Create BEO user with portfolio access
    beoUser = await prisma.user.create({
      data: {
        username: 'cfo-test',
        passwordHash: await bcrypt.hash('test123', 10),
        jobTitle: 'CFO',
        userOrganizations: {
          create: {
            organizationId: 'ALL_ORGS',
            role: 'admin',
            capabilities: ['perm_ViewAllOrgs'],
          },
        },
      },
    });

    // Create regular user WITHOUT portfolio access
    regularUser = await prisma.user.create({
      data: {
        username: 'pm-test',
        passwordHash: await bcrypt.hash('test123', 10),
        userOrganizations: {
          create: {
            organizationId: 'HOLNG',
            role: 'user',
            capabilities: ['perm_View'],
          },
        },
      },
    });

    // Seed test PFA data with variances
    await prisma.pfaRecord.createMany({
      data: [
        {
          id: 'pfa-1',
          organizationId: 'HOLNG',
          planCost: 1000000,
          forecastCost: 1450000, // +$450K variance
          category: 'Crane - Mobile',
        },
        {
          id: 'pfa-2',
          organizationId: 'RIO',
          planCost: 800000,
          forecastCost: 1080000, // +$280K variance
          category: 'Generator',
        },
        {
          id: 'pfa-3',
          organizationId: 'PEMS_Global',
          planCost: 500000,
          forecastCost: 595000, // +$95K variance
          category: 'Scaffolding',
        },
      ],
    });
  });

  // Test 1: Portfolio Variance Query
  it('should answer "Which projects are over budget?"', async () => {
    const response = await request(app)
      .post('/api/beo/query')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({
        query: 'Which projects are trending over budget and why?',
        responseFormat: 'conversational',
      });

    expect(response.status).toBe(200);
    expect(response.body.narrative).toContain('Three of your seven projects');
    expect(response.body.executiveSummary.portfolioVariance).toContain('+$825K');
    expect(response.body.executiveSummary.projectsAtRisk).toBe(3);
    expect(response.body.detailedBreakdown.length).toBe(3);
    expect(response.body.confidence).toBeGreaterThan(0.9);
  });

  // Test 2: Voice Response Generation
  it('should generate natural voice response', async () => {
    const response = await request(app)
      .post('/api/beo/query')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({
        query: 'Portfolio status?',
        responseFormat: 'conversational',
      });

    expect(response.body.voiceResponse).toBeTruthy();
    expect(response.body.voiceResponse.length).toBeLessThan(500); // Concise for TTS
    expect(response.body.voiceResponse).not.toContain('$'); // No dollar signs (say "dollars")
  });

  // Test 3: Follow-up Question Context
  it('should handle follow-up "Tell me more about HOLNG"', async () => {
    const initial = await request(app)
      .post('/api/beo/query')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({
        query: 'Which projects are over budget?',
        responseFormat: 'conversational',
      });

    const followup = await request(app)
      .post('/api/beo/query')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({
        query: 'Tell me more about HOLNG',
        context: initial.body.queryId,
        responseFormat: 'conversational',
      });

    expect(followup.status).toBe(200);
    expect(followup.body.narrative).toContain('$450K');
    expect(followup.body.narrative).toContain('Weather');
    expect(followup.body.executiveSummary.organization).toBe('HOLNG');
  });

  // Test 4: Executive Persona Adaptation
  it('should adapt response for CFO vs. COO', async () => {
    // Create COO user
    const cooUser = await prisma.user.create({
      data: {
        username: 'coo-test',
        passwordHash: await bcrypt.hash('test123', 10),
        jobTitle: 'COO',
        userOrganizations: {
          create: {
            organizationId: 'ALL_ORGS',
            role: 'admin',
            capabilities: ['perm_ViewAllOrgs'],
          },
        },
      },
    });

    const cfoResponse = await request(app)
      .post('/api/beo/query')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({ query: 'Project status?', responseFormat: 'conversational' });

    const cooResponse = await request(app)
      .post('/api/beo/query')
      .set('Authorization', `Bearer ${generateToken(cooUser)}`)
      .send({ query: 'Project status?', responseFormat: 'conversational' });

    // CFO response emphasizes financials
    expect(cfoResponse.body.narrative).toContain('budget');
    expect(cfoResponse.body.narrative).toContain('variance');

    // COO response emphasizes operations
    expect(cooResponse.body.narrative).toContain('schedule');
    expect(cooResponse.body.narrative).toContain('delays');
  });

  // Test 5: Data Accuracy Verification
  it('should provide accurate financial calculations', async () => {
    const response = await request(app)
      .post('/api/beo/query')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({
        query: 'What is our total portfolio variance?',
        responseFormat: 'conversational',
      });

    // Manually verify calculation
    const manualCalc = 450000 + 280000 + 95000; // = $825K
    expect(response.body.executiveSummary.portfolioVariance).toBe(`+$${manualCalc.toLocaleString()}`);
  });

  // Test 6: Query Response Time
  it('should respond to executive queries in <3 seconds', async () => {
    const start = Date.now();
    await request(app)
      .post('/api/beo/query')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({
        query: 'Which projects are over budget?',
        responseFormat: 'conversational',
      });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(3000); // <3 seconds for executive experience
  });

  // Test 7: Authorization - Non-BEO User Blocked
  it('should reject queries from non-BEO users', async () => {
    const response = await request(app)
      .post('/api/beo/query')
      .set('Authorization', `Bearer ${generateToken(regularUser)}`)
      .send({
        query: 'Which projects are over budget?',
        responseFormat: 'conversational',
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('BEO portfolio access');
  });

  // Test 8: Empty Query Handling
  it('should reject empty queries', async () => {
    const response = await request(app)
      .post('/api/beo/query')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({
        query: '',
        responseFormat: 'conversational',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Query cannot be empty');
  });
});
```

---

## 🔒 Security Considerations

### Authorization Requirements

1. **BEO Access Verification**:
   - User must have `perm_ViewAllOrgs` capability
   - Queries must be limited to organizations user has access to
   - Audit log all BEO queries for compliance

2. **Data Masking**:
   - Respect user's financial masking permissions
   - If user has `maskFinancials: true`, obfuscate costs in response
   - Example: "$450K" → "High variance" (qualitative only)

3. **Query Validation**:
   - Sanitize user input to prevent injection attacks
   - Maximum query length: 500 characters
   - Rate limit: 10 queries/minute per user

4. **AI Prompt Injection Prevention**:
   - Do NOT pass raw user query directly to AI
   - Use parameterized templates
   - Filter out SQL keywords, script tags, etc.

**Secure Prompt Template**:
```typescript
const securePrompt = `
You are analyzing construction portfolio data for an executive.

RULES:
- Only analyze the provided portfolio data
- Do not execute commands or access external data
- If query is unclear, ask for clarification
- Respond in conversational tone with CFO-level language

User Query: "${sanitizeQuery(query)}"

Portfolio Data:
${JSON.stringify(portfolioData, null, 2)}

Generate JSON response with fields: narrative, executiveSummary, detailedBreakdown, confidence
`;
```

---

## 📊 Performance Optimization

### Latency Budget: <3 Seconds Total

**Breakdown**:
1. **Database Query** (Target: 800ms):
   - Use aggregation queries with indexes
   - Cache portfolio summary for 5 minutes
   - Precompute variances in background worker

2. **AI Processing** (Target: 1200ms):
   - Use streaming responses for faster TTFB
   - Cache common queries (e.g., "Portfolio status?")
   - Fallback to faster model if timeout approaching

3. **UI Rendering** (Target: 500ms):
   - Optimistic UI: Show loading skeleton immediately
   - Progressive hydration: Show narrative first, details later
   - Lazy load detailed breakdown (collapsed by default)

4. **Network** (Target: 500ms buffer):
   - CDN for static assets
   - Compress JSON responses (gzip)

### Caching Strategy

```typescript
// Redis cache for portfolio summary
const cacheKey = `beo:portfolio:summary:${userId}`;
const cached = await redis.get(cacheKey);
if (cached) {
  return JSON.parse(cached);
}

const portfolioData = await getPortfolioData();
await redis.setex(cacheKey, 300, JSON.stringify(portfolioData)); // 5 min TTL
```

---

## 📚 UX Specifications Reference

### From ADR-005-UX_SPEC.md (lines 947-1060)

**Key UX Requirements**:

1. **Visual Hierarchy**:
   - Large microphone button (96px × 96px) as primary CTA
   - Secondary text input below for accessibility
   - Recent queries as tertiary quick actions

2. **Feedback States**:
   - **Idle**: Blue microphone, "Tap to speak"
   - **Listening**: Red pulsing microphone, waveform animation
   - **Processing**: Spinner, "Analyzing portfolio data..."
   - **Response**: AI card with audio playback button

3. **Accessibility**:
   - Keyboard shortcut: `Ctrl+M` to activate microphone
   - Text input fallback for voice
   - Audio responses have text transcripts
   - Screen reader: "12 projects analyzed, 3 at risk"

4. **Responsive Design**:
   - **Desktop**: Side-by-side layout (query left, response right)
   - **Tablet**: Stacked layout (query top, response bottom)
   - **Mobile**: Single column, collapsible breakdown

5. **Color Coding**:
   - **Red**: Over budget, critical variance
   - **Orange**: Moderate variance, requires attention
   - **Blue**: Neutral info, total spend metrics
   - **Green**: Under budget, positive variance

---

## 🚀 Implementation Checklist

### Backend Tasks

- [ ] **Create `BeoAnalyticsService.ts`**:
  - [ ] Implement `answerPortfolioQuery()` method
  - [ ] Implement `verifyBeoAccess()` permission check
  - [ ] Implement `getPortfolioData()` aggregation
  - [ ] Implement `detectPersona()` based on user.jobTitle
  - [ ] Implement `generatePrompt()` with persona templates
  - [ ] Implement `toVoiceResponse()` TTS optimization

- [ ] **Database Schema**:
  - [ ] Create `AiQueryLog` model (Prisma schema)
  - [ ] Run migration: `npx prisma migrate dev --name add_ai_query_log`
  - [ ] Add indexes on `userId`, `createdAt`

- [ ] **API Routes**:
  - [ ] Create `POST /api/beo/query` endpoint
  - [ ] Create `GET /api/beo/recent-queries` endpoint
  - [ ] Add `requirePermission('perm_ViewAllOrgs')` middleware
  - [ ] Add rate limiting (10 queries/minute)

- [ ] **Performance**:
  - [ ] Add Redis caching for portfolio summary (5 min TTL)
  - [ ] Add database indexes on `pfaRecord.organizationId`
  - [ ] Optimize aggregation queries with EXPLAIN

### Frontend Tasks

- [ ] **Create `VoiceAnalyst.tsx` Component**:
  - [ ] Implement microphone button with Web Speech API
  - [ ] Implement waveform animation during listening
  - [ ] Implement text input fallback
  - [ ] Implement keyboard shortcut (`Ctrl+M`)
  - [ ] Implement TTS playback with `speechSynthesis`
  - [ ] Implement context preservation for follow-ups
  - [ ] Implement recent queries UI

- [ ] **API Client Methods**:
  - [ ] Add `queryBeoAnalytics()` to `apiClient.ts`
  - [ ] Add `getBeoRecentQueries()` to `apiClient.ts`

- [ ] **Styling**:
  - [ ] Add waveform animation keyframes to `globals.css`
  - [ ] Add responsive breakpoints (mobile, tablet, desktop)
  - [ ] Add loading skeleton for AI responses

### Testing Tasks

- [ ] **Unit Tests** (`beoAnalyticsService.test.ts`):
  - [ ] Test `verifyBeoAccess()` for BEO vs. regular users
  - [ ] Test `detectPersona()` for CFO vs. COO
  - [ ] Test `toVoiceResponse()` text transformations

- [ ] **Integration Tests** (`beoVoiceAnalyst.test.ts`):
  - [ ] Test 1: Portfolio variance query
  - [ ] Test 2: Voice response generation
  - [ ] Test 3: Follow-up question context
  - [ ] Test 4: Persona adaptation (CFO vs. COO)
  - [ ] Test 5: Data accuracy verification
  - [ ] Test 6: Query response time (<3s)
  - [ ] Test 7: Authorization (non-BEO blocked)
  - [ ] Test 8: Empty query handling

- [ ] **E2E Tests** (`voiceAnalystE2E.test.ts`):
  - [ ] Test voice input flow (requires headless browser with audio)
  - [ ] Test TTS playback
  - [ ] Test keyboard shortcuts

### Documentation Tasks

- [ ] **API Documentation**:
  - [ ] Document `POST /api/beo/query` in API_REFERENCE.md
  - [ ] Document request/response schemas
  - [ ] Add example queries and responses

- [ ] **User Guide**:
  - [ ] Add "Voice Analyst" section to USER_GUIDE.md
  - [ ] Include screenshots of voice input flow
  - [ ] List supported query types

---

## 🎯 Acceptance Criteria

### Functional Requirements

✅ **BEO users can ask natural language portfolio queries**
- Voice input via microphone button
- Text input fallback available
- Keyboard shortcut (`Ctrl+M`) works

✅ **AI provides accurate conversational responses**
- Narrative summary matches portfolio data
- Executive summary metrics are correct
- Detailed breakdown includes root causes

✅ **Persona adaptation works**
- CFO users see financial emphasis (budget, variance)
- COO users see operational emphasis (schedule, delays)

✅ **Follow-up questions preserve context**
- Initial query: "Which projects are over budget?"
- Follow-up: "Tell me more about HOLNG" → AI remembers context

✅ **Voice output works**
- Text-to-speech playback available
- Voice response optimized for TTS (<500 chars, no "$")

### Non-Functional Requirements

✅ **Performance**:
- Query response time: <3 seconds (95th percentile)
- Database queries: <800ms
- AI processing: <1200ms

✅ **Security**:
- Non-BEO users receive 403 error
- Query input sanitized (no injection attacks)
- Audit log records all queries

✅ **Accessibility**:
- Voice input has text fallback
- Audio responses have text transcripts
- Screen reader compatible
- WCAG 2.1 AA compliant

✅ **Reliability**:
- AI confidence score displayed
- Graceful degradation if AI fails (fallback to structured data)
- Rate limiting prevents abuse (10 queries/minute)

---

## 📝 Notes for Implementation

### AI Provider Recommendations

**Recommended**: Google Gemini Pro
- **Pros**: Fast (<1s latency), good at structured output, cost-effective
- **Cons**: Occasional hallucinations (mitigate with confidence scores)

**Fallback**: OpenAI GPT-4 Turbo
- **Pros**: Higher accuracy, better reasoning
- **Cons**: Slower (1.5-2s latency), more expensive

### Web Speech API Browser Support

**Supported**:
- Chrome/Edge: `webkitSpeechRecognition` ✅
- Safari: Partial support (iOS 14.5+) ✅

**Not Supported**:
- Firefox: ❌ (show alert, redirect to text input)

**Polyfill**: Consider using Azure Speech SDK for Firefox users.

### TTS Optimization Tips

**Convert**:
- "$450K" → "four hundred fifty thousand dollars"
- "+12%" → "twelve percent increase"
- "HOLNG" → "H O L N G" (spell acronyms)

**Avoid**:
- Technical jargon ("PFA", "DOR", "BEO")
- Long numbers (round to nearest thousand)
- Nested clauses (keep sentences short)

---

## 🔗 Related Documentation

- **ADR-005-AI_OPPORTUNITIES.md**: Use Case 21 specification
- **ADR-005-UX_SPEC.md**: Visual design mockups (lines 947-1060)
- **ADR-005-TEST_PLAN.md**: Test scenarios (lines 1678-1783)
- **ADR-005-IMPLEMENTATION_PLAN.md**: Technical specs (lines 3820-3990)

---

**End of Prompt Bundle: Task 8.1 - Boardroom Voice Analyst**

**Status**: Ready for Execution by `ai-systems-architect`
**Estimated Completion**: 0.5 days
**Next Task**: 8.2 - Narrative Variance Generator

---

# Phase 8 Task 8.2: Narrative Variance Generator (UC 22) - Complete Prompt Bundle

**Agent Assignment**: `ai-systems-architect`
**Estimated Duration**: 0.5 days
**Status**: Ready for Execution
**Dependencies**: Phase 6 Complete (AI Foundation), Task 8.1 (Voice Analyst)

---

## 🎯 Executive Summary

**Mission**: Implement an AI-powered narrative generation system that converts raw budget variance data into executive-ready storytelling. Transform spreadsheet numbers into chapter-based narratives that explain "why" variances occurred, backed by audit log evidence.

**Business Value**:
- **Board Meeting Prep**: Auto-generate variance explanations for board decks (saves 2-4 hours/month)
- **Stakeholder Communication**: Professional, consistent narratives for stakeholder updates
- **Root Cause Transparency**: AI links variance to audit log events (weather delays, user actions)
- **PDF Export**: Ready-to-present board reports with timeline visualizations

**Key Deliverables**:
1. `NarrativeExplainerService.ts` - AI-powered variance narrative generation
2. `NarrativeReader.tsx` - Chapter-based storytelling UI component
3. PDF export with timeline visualizations
4. Audit log evidence linking (connects variance to specific user actions)
5. Root cause detection (weather, equipment substitutions, scope changes)

---

## 📋 Context & Requirements

### Use Case 22: Narrative Variance Explanation

**User Story**:
> As a **CFO** (BEO user),
> I want to **auto-generate executive summaries of budget variances** in narrative form,
> so that I can **present compelling variance explanations at board meetings** without manual report writing.

**Key Features**:

1. **Chapter-Based Storytelling**:
   - **Chapter 1**: The Plan (original budget, baseline)
   - **Chapter 2**: The Event (what happened - weather, delays, scope change)
   - **Chapter 3**: Equipment Impact (which PFA records were affected)
   - **Chapter 4**: The Ripple Effect (cascading impacts on other equipment)
   - **Chapter 5**: The Outcome (total variance, insurance claims, next steps)

2. **Evidence-Backed Narratives**:
   - Links variance to audit log entries
   - Shows WHO made changes (e.g., "John Doe extended 18 crane rentals")
   - Shows WHEN changes occurred (e.g., "Nov 21-25")
   - Shows WHY changes were made (e.g., "Weather delay - concrete curing")

3. **Timeline Visualization**:
   - ASCII timeline showing events in chronological order
   - Variance waterfall: Plan → Event → Crane Extensions → Ripple Effect → Forecast
   - Export as interactive SVG for PowerPoint

4. **Key Takeaways Summary**:
   - Bullet-point summary at end of narrative
   - Actionable recommendations
   - Insurance claim status (if applicable)

5. **Reading Progress Indicator**:
   - Sticky progress bar showing chapter position
   - Estimated reading time (e.g., "8 min read")
   - Auto-save reading position (resume where left off)

6. **PDF Export**:
   - Professional formatting for board decks
   - Includes timeline visualization
   - Footer: "Generated by PFA Vanguard AI - [Date]"

---

## 🛠️ Technical Specifications

### Backend Implementation

**File**: `backend/src/services/ai/NarrativeExplainerService.ts`

**Core Methods**:

```typescript
export class NarrativeExplainerService {
  /**
   * Generate executive-level narrative explanation for budget variance
   *
   * @param organizationId - Project to analyze (e.g., 'HOLNG')
   * @param variance - Total variance amount (e.g., 450000 for $450K)
   * @param variancePercent - Variance percentage (e.g., 12 for +12%)
   *
   * @returns {Object} Chapter-based narrative with evidence and timeline
   */
  async explainVariance(params: {
    organizationId: string;
    variance: number;
    variancePercent: number;
  }): Promise<{
    narrativeId: string; // For tracking
    title: string; // e.g., "The November Weather Delay Story: How HOLNG went $450K over budget"
    chapters: Array<{
      number: number;
      title: string;
      content: string; // Narrative text (2-3 paragraphs)
      evidence?: Array<{
        type: 'audit_log' | 'weather_data' | 'financial_summary';
        summary: string;
        details: any;
      }>;
      financialImpact?: number; // $ amount attributed to this chapter
    }>;
    keyTakeaways: string[]; // Bullet points
    timeline: TimelineEvent[]; // For visualization
    recommendations: string[];
    estimatedReadTime: number; // Minutes
  }>;

  /**
   * Get detailed PFA data and audit logs for an organization
   *
   * Queries:
   * - All PFA records with forecast vs. plan variance
   * - Audit log entries where action = 'updated' and organizationId matches
   * - Groups changes by user, date, and reason field
   */
  private async getVarianceData(organizationId: string): Promise<{
    pfaRecords: PfaRecord[];
    auditLogs: AuditLogEntry[];
    categoryVariances: Record<string, number>; // Variance by category
    userActions: Record<string, number>; // Changes by user
  }>;

  /**
   * Use AI to generate narrative chapters
   *
   * Prompt Engineering:
   * - Persona: "You are a CFO explaining variance to the board"
   * - Tone: Professional, analytical, actionable
   * - Structure: 5 chapters with evidence-backed explanations
   * - Constraints: Each chapter 150-250 words, avoid jargon
   */
  private async generateChapters(
    varianceData: any,
    variance: number,
    variancePercent: number
  ): Promise<Chapter[]>;

  /**
   * Build timeline visualization data
   *
   * Timeline Events:
   * - Original Plan Date (baseline)
   * - Triggering Event (weather, scope change)
   * - Equipment Extensions (PFA changes)
   * - Ripple Effects (cascading impacts)
   * - New Forecast Date
   */
  private buildTimeline(varianceData: any): TimelineEvent[];

  /**
   * Extract key takeaways and recommendations
   *
   * Uses AI to:
   * - Summarize root causes (3-5 bullet points)
   * - Identify actionable recommendations
   * - Flag insurance claim opportunities
   */
  private extractTakeaways(chapters: Chapter[]): {
    keyTakeaways: string[];
    recommendations: string[];
  };
}

interface Chapter {
  number: number;
  title: string;
  content: string;
  evidence?: Evidence[];
  financialImpact?: number;
}

interface Evidence {
  type: 'audit_log' | 'weather_data' | 'financial_summary';
  summary: string; // e.g., "18 PFA records modified by john.doe"
  details: {
    count?: number;
    usernames?: string[];
    commonReasons?: Record<string, number>; // Reason → count
    dateRange?: { start: Date; end: Date };
  };
}

interface TimelineEvent {
  date: Date;
  label: string; // e.g., "Weather Event", "Crane Extensions"
  type: 'plan' | 'event' | 'impact' | 'forecast';
  financialImpact?: number;
  description?: string;
}
```

**Database Schema Requirements**:

```prisma
model NarrativeReport {
  id                String   @id @default(cuid())
  narrativeId       String   @unique
  organizationId    String
  title             String
  chapters          Json     // Array of Chapter objects
  keyTakeaways      Json     // Array of strings
  timeline          Json     // Array of TimelineEvent objects
  recommendations   Json     // Array of strings
  estimatedReadTime Int      // Minutes
  generatedAt       DateTime @default(now())
  generatedBy       String   // User ID

  // Reading Progress Tracking
  readingProgress   Json?    // Map<userId, { chapter: number, timestamp: Date }>

  // Relations
  organization      Organization @relation(fields: [organizationId], references: [id])
  user              User         @relation(fields: [generatedBy], references: [id])

  @@index([organizationId, generatedAt])
}
```

**API Endpoints**:

```typescript
// POST /api/beo/narrative/generate
router.post('/narrative/generate', requirePermission('perm_ViewAllOrgs'), async (req, res) => {
  const { organizationId } = req.body;

  // Calculate current variance
  const variance = await calculateVariance(organizationId);

  const narrative = await narrativeExplainerService.explainVariance({
    organizationId,
    variance: variance.amount,
    variancePercent: variance.percent,
  });

  // Save to database
  await prisma.narrativeReport.create({
    data: {
      narrativeId: narrative.narrativeId,
      organizationId,
      title: narrative.title,
      chapters: narrative.chapters,
      keyTakeaways: narrative.keyTakeaways,
      timeline: narrative.timeline,
      recommendations: narrative.recommendations,
      estimatedReadTime: narrative.estimatedReadTime,
      generatedBy: req.user!.id,
    },
  });

  res.json(narrative);
});

// GET /api/beo/narrative/:narrativeId
router.get('/narrative/:narrativeId', requirePermission('perm_ViewAllOrgs'), async (req, res) => {
  const narrative = await prisma.narrativeReport.findUnique({
    where: { narrativeId: req.params.narrativeId },
  });

  if (!narrative) {
    return res.status(404).json({ error: 'Narrative not found' });
  }

  res.json(narrative);
});

// POST /api/beo/narrative/:narrativeId/progress
router.post('/narrative/:narrativeId/progress', async (req, res) => {
  const { chapter } = req.body;

  await prisma.narrativeReport.update({
    where: { narrativeId: req.params.narrativeId },
    data: {
      readingProgress: {
        [req.user!.id]: { chapter, timestamp: new Date() },
      },
    },
  });

  res.json({ success: true });
});

// GET /api/beo/narrative/:narrativeId/export-pdf
router.get('/narrative/:narrativeId/export-pdf', async (req, res) => {
  const narrative = await prisma.narrativeReport.findUnique({
    where: { narrativeId: req.params.narrativeId },
  });

  const pdf = await generateNarrativePDF(narrative);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${narrative!.title}.pdf"`);
  res.send(pdf);
});
```

---

### Frontend Implementation

**File**: `components/beo/NarrativeReader.tsx`

**Component Structure**:

```tsx
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, FileText, Download } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface Chapter {
  number: number;
  title: string;
  content: string;
  evidence?: Evidence[];
  financialImpact?: number;
}

interface Evidence {
  type: 'audit_log' | 'weather_data' | 'financial_summary';
  summary: string;
  details: any;
}

interface TimelineEvent {
  date: Date;
  label: string;
  type: 'plan' | 'event' | 'impact' | 'forecast';
  financialImpact?: number;
  description?: string;
}

interface NarrativeReport {
  narrativeId: string;
  title: string;
  chapters: Chapter[];
  keyTakeaways: string[];
  timeline: TimelineEvent[];
  recommendations: string[];
  estimatedReadTime: number;
}

export function NarrativeReader({ organizationId }: { organizationId: string }) {
  const [narrative, setNarrative] = useState<NarrativeReport | null>(null);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedEvidence, setExpandedEvidence] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  useEffect(() => {
    generateNarrative();
  }, [organizationId]);

  // Auto-save reading progress
  useEffect(() => {
    if (narrative) {
      saveReadingProgress();
    }
  }, [currentChapter]);

  const generateNarrative = async () => {
    setLoading(true);
    try {
      const result = await apiClient.generateNarrative({ organizationId });
      setNarrative(result);
    } catch (error) {
      console.error('Failed to generate narrative:', error);
      alert('Failed to generate variance narrative');
    } finally {
      setLoading(false);
    }
  };

  const saveReadingProgress = async () => {
    if (!narrative) return;
    await apiClient.updateNarrativeProgress({
      narrativeId: narrative.narrativeId,
      chapter: currentChapter,
    });
  };

  const nextChapter = () => {
    if (narrative && currentChapter < narrative.chapters.length - 1) {
      setCurrentChapter(currentChapter + 1);
      setExpandedEvidence(false); // Collapse evidence when changing chapters
    }
  };

  const previousChapter = () => {
    if (currentChapter > 0) {
      setCurrentChapter(currentChapter - 1);
      setExpandedEvidence(false);
    }
  };

  const exportPDF = async () => {
    if (!narrative) return;
    const blob = await apiClient.exportNarrativePDF(narrative.narrativeId);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${narrative.title}.pdf`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Generating variance narrative...</p>
          <p className="text-sm text-gray-500 mt-2">Analyzing audit logs and financial data</p>
        </div>
      </div>
    );
  }

  if (!narrative) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-600">No narrative available</p>
      </div>
    );
  }

  const chapter = narrative.chapters[currentChapter];
  const progress = ((currentChapter + 1) / narrative.chapters.length) * 100;

  return (
    <div className="narrative-reader max-w-4xl mx-auto p-6">
      {/* Sticky Progress Bar */}
      <div className="sticky top-0 bg-white border-b pb-4 mb-6 z-10">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            📖 {narrative.title}
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{narrative.estimatedReadTime} min read</span>
            <button
              onClick={exportPDF}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition flex items-center gap-1"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="mb-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Chapter Navigation Pills */}
        <div className="flex gap-2 flex-wrap">
          {narrative.chapters.map((ch, i) => (
            <button
              key={i}
              onClick={() => {
                setCurrentChapter(i);
                setExpandedEvidence(false);
              }}
              className={`px-3 py-1 rounded text-sm transition ${
                i === currentChapter
                  ? 'bg-blue-500 text-white'
                  : i < currentChapter
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {i < currentChapter ? '✅' : i === currentChapter ? '●' : '○'} Chapter {ch.number}
            </button>
          ))}
        </div>
      </div>

      {/* Chapter Content */}
      <div className="bg-white rounded-lg shadow-md p-8">
        {/* Chapter Header */}
        <div className="border-b pb-4 mb-6">
          <div className="flex items-center gap-4 mb-2">
            <span className="text-4xl font-bold text-blue-500">Chapter {chapter.number}</span>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{chapter.title}</h2>
              {chapter.financialImpact && (
                <p className="text-red-600 font-semibold mt-1">
                  Financial Impact: ${chapter.financialImpact.toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Narrative Content */}
        <div className="prose prose-lg max-w-none mb-6">
          {chapter.content.split('\n\n').map((paragraph, i) => (
            <p key={i} className="text-gray-800 leading-relaxed mb-4">
              {paragraph}
            </p>
          ))}
        </div>

        {/* Evidence Section (Collapsible) */}
        {chapter.evidence && chapter.evidence.length > 0 && (
          <div className="border-t pt-4">
            <button
              onClick={() => setExpandedEvidence(!expandedEvidence)}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-3"
            >
              <FileText className="w-5 h-5" />
              {expandedEvidence ? 'Hide' : 'Show'} Evidence ({chapter.evidence.length} items)
            </button>

            {expandedEvidence && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                {chapter.evidence.map((ev, i) => (
                  <div key={i} className="bg-white p-3 rounded border">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      📄 {ev.type === 'audit_log' ? 'Audit Log' : ev.type === 'weather_data' ? 'Weather Data' : 'Financial Summary'}:
                    </p>
                    <p className="text-sm text-gray-600">{ev.summary}</p>

                    {/* Detailed Evidence */}
                    {ev.details && (
                      <div className="mt-2 text-xs text-gray-500 space-y-1">
                        {ev.details.count && <p>• Count: {ev.details.count}</p>}
                        {ev.details.usernames && (
                          <p>• Users: {ev.details.usernames.join(', ')}</p>
                        )}
                        {ev.details.commonReasons && (
                          <div>
                            <p>• Common Reasons:</p>
                            <ul className="ml-4">
                              {Object.entries(ev.details.commonReasons).map(([reason, count]) => (
                                <li key={reason}>
                                  "{reason}" ({count} times)
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {ev.details.dateRange && (
                          <p>
                            • Date Range: {new Date(ev.details.dateRange.start).toLocaleDateString()} -{' '}
                            {new Date(ev.details.dateRange.end).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center mt-8 pt-6 border-t">
          <button
            onClick={previousChapter}
            disabled={currentChapter === 0}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>

          {currentChapter === narrative.chapters.length - 1 ? (
            <button
              onClick={() => setShowTimeline(true)}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition"
            >
              View Key Takeaways →
            </button>
          ) : (
            <button
              onClick={nextChapter}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition flex items-center gap-2"
            >
              Continue Reading
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Key Takeaways (shown at end or via button) */}
      {(showTimeline || currentChapter === narrative.chapters.length - 1) && (
        <div className="bg-white rounded-lg shadow-md p-8 mt-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            🎯 Key Takeaways
          </h2>

          <ul className="space-y-2 mb-6">
            {narrative.keyTakeaways.map((takeaway, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-blue-500 font-bold">•</span>
                <span className="text-gray-800">{takeaway}</span>
              </li>
            ))}
          </ul>

          {/* Recommendations */}
          {narrative.recommendations.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">💡 Recommended Actions:</h3>
              <ul className="space-y-1">
                {narrative.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-gray-700">
                    • {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Timeline Visualization */}
          <div className="border-t pt-6">
            <h3 className="font-semibold text-gray-900 mb-4">📅 Timeline Visualization</h3>
            <TimelineVisualization events={narrative.timeline} />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={exportPDF}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Export as PDF
            </button>
            <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition">
              📧 Email to Stakeholders
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Timeline Visualization Component
function TimelineVisualization({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="bg-gray-50 p-6 rounded-lg overflow-x-auto">
      <div className="flex items-center gap-8 min-w-max">
        {events.map((event, i) => (
          <div key={i} className="relative">
            {/* Timeline Line */}
            {i < events.length - 1 && (
              <div className="absolute top-6 left-full w-8 h-0.5 bg-gray-300"></div>
            )}

            {/* Event Node */}
            <div className="flex flex-col items-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold mb-2 ${
                  event.type === 'plan'
                    ? 'bg-blue-500'
                    : event.type === 'event'
                    ? 'bg-red-500'
                    : event.type === 'impact'
                    ? 'bg-orange-500'
                    : 'bg-green-500'
                }`}
              >
                {event.type === 'plan' ? '📋' : event.type === 'event' ? '⚠️' : event.type === 'impact' ? '📊' : '✅'}
              </div>

              <p className="text-sm font-medium text-gray-900 text-center max-w-[120px] mb-1">
                {event.label}
              </p>

              <p className="text-xs text-gray-600 text-center">
                {new Date(event.date).toLocaleDateString()}
              </p>

              {event.financialImpact && (
                <p
                  className={`text-sm font-bold mt-1 ${
                    event.financialImpact > 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {event.financialImpact > 0 ? '+' : ''}${event.financialImpact.toLocaleString()}
                </p>
              )}

              {event.description && (
                <p className="text-xs text-gray-500 text-center max-w-[120px] mt-1">
                  {event.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 🧪 Testing Requirements

### Test Suite Location
**File**: `backend/tests/integration/narrativeExplainer.test.ts`

### Test Scenarios

```typescript
describe('Use Case 22: Narrative Variance Explainer', () => {
  let beoUser: User;
  let org: Organization;

  beforeEach(async () => {
    // Create BEO user
    beoUser = await prisma.user.create({
      data: {
        username: 'cfo-narrative-test',
        passwordHash: await bcrypt.hash('test123', 10),
        jobTitle: 'CFO',
        userOrganizations: {
          create: {
            organizationId: 'ALL_ORGS',
            role: 'admin',
            capabilities: ['perm_ViewAllOrgs'],
          },
        },
      },
    });

    // Create organization with variance
    org = await prisma.organization.create({
      data: {
        id: 'HOLNG',
        name: 'Houston LNG Project',
      },
    });

    // Seed PFA records with variance
    await prisma.pfaRecord.createMany({
      data: [
        {
          id: 'pfa-crane-1',
          organizationId: 'HOLNG',
          category: 'Crane - Mobile 200T',
          planCost: 100000,
          forecastCost: 150000, // +$50K
          planStart: new Date('2025-11-01'),
          planEnd: new Date('2025-11-25'),
          forecastStart: new Date('2025-11-01'),
          forecastEnd: new Date('2025-12-10'), // +15 days extension
        },
        // ... 17 more crane records
      ],
    });

    // Seed audit log entries
    await prisma.auditLogEntry.createMany({
      data: [
        {
          userId: 'john.doe',
          organizationId: 'HOLNG',
          action: 'updated',
          entityType: 'pfa',
          entityId: 'pfa-crane-1',
          changes: JSON.stringify({
            field: 'forecastEnd',
            oldValue: '2025-11-25',
            newValue: '2025-12-10',
            reason: 'Weather delay - concrete curing',
          }),
          timestamp: new Date('2025-11-21'),
        },
        // ... 17 more audit entries
      ],
    });
  });

  // Test 1: Chapter Generation
  it('should generate 5-chapter narrative', async () => {
    const response = await request(app)
      .post('/api/beo/narrative/generate')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({ organizationId: 'HOLNG' });

    expect(response.status).toBe(200);
    expect(response.body.chapters.length).toBe(5);
    expect(response.body.chapters[0].title).toContain('Plan');
    expect(response.body.chapters[1].title).toContain('Event');
    expect(response.body.chapters[2].title).toContain('Equipment');
    expect(response.body.chapters[3].title).toContain('Ripple');
    expect(response.body.chapters[4].title).toContain('Outcome');
  });

  // Test 2: Evidence Linking
  it('should link variance to audit log evidence', async () => {
    const response = await request(app)
      .post('/api/beo/narrative/generate')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({ organizationId: 'HOLNG' });

    const chapter3 = response.body.chapters[2]; // Equipment Impact chapter
    expect(chapter3.evidence).toBeTruthy();
    expect(chapter3.evidence[0].type).toBe('audit_log');
    expect(chapter3.evidence[0].summary).toContain('18 PFA records modified');
    expect(chapter3.evidence[0].details.usernames).toContain('john.doe');
    expect(chapter3.evidence[0].details.commonReasons['Weather delay']).toBeGreaterThan(0);
  });

  // Test 3: Timeline Generation
  it('should generate timeline with financial impacts', async () => {
    const response = await request(app)
      .post('/api/beo/narrative/generate')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({ organizationId: 'HOLNG' });

    expect(response.body.timeline.length).toBeGreaterThan(3);
    const eventNode = response.body.timeline.find((e: any) => e.type === 'event');
    expect(eventNode.label).toContain('Weather');
    expect(eventNode.financialImpact).toBeGreaterThan(0);
  });

  // Test 4: Key Takeaways Extraction
  it('should extract key takeaways and recommendations', async () => {
    const response = await request(app)
      .post('/api/beo/narrative/generate')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({ organizationId: 'HOLNG' });

    expect(response.body.keyTakeaways.length).toBeGreaterThan(3);
    expect(response.body.keyTakeaways[0]).toContain('Weather');
    expect(response.body.recommendations.length).toBeGreaterThan(0);
    expect(response.body.recommendations[0]).toContain('claim'); // Insurance claim
  });

  // Test 5: Reading Time Estimation
  it('should estimate reading time based on word count', async () => {
    const response = await request(app)
      .post('/api/beo/narrative/generate')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({ organizationId: 'HOLNG' });

    // Avg reading speed: 200 words/min
    // 5 chapters × 200 words = 1000 words → ~5 min
    expect(response.body.estimatedReadTime).toBeGreaterThan(3);
    expect(response.body.estimatedReadTime).toBeLessThan(15);
  });

  // Test 6: Reading Progress Tracking
  it('should save and retrieve reading progress', async () => {
    const narrativeRes = await request(app)
      .post('/api/beo/narrative/generate')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({ organizationId: 'HOLNG' });

    const narrativeId = narrativeRes.body.narrativeId;

    // Save progress (user on chapter 3)
    await request(app)
      .post(`/api/beo/narrative/${narrativeId}/progress`)
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({ chapter: 2 });

    // Retrieve narrative
    const getRes = await request(app)
      .get(`/api/beo/narrative/${narrativeId}`)
      .set('Authorization', `Bearer ${generateToken(beoUser)}`);

    expect(getRes.body.readingProgress[beoUser.id].chapter).toBe(2);
  });

  // Test 7: PDF Export
  it('should export narrative as PDF', async () => {
    const narrativeRes = await request(app)
      .post('/api/beo/narrative/generate')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({ organizationId: 'HOLNG' });

    const pdfRes = await request(app)
      .get(`/api/beo/narrative/${narrativeRes.body.narrativeId}/export-pdf`)
      .set('Authorization', `Bearer ${generateToken(beoUser)}`);

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toBe('application/pdf');
    expect(pdfRes.body.length).toBeGreaterThan(0); // PDF has content
  });
});
```

---

## 🔒 Security Considerations

### Authorization
- Only BEO users with `perm_ViewAllOrgs` can generate narratives
- Narratives can only be generated for organizations user has access to
- Reading progress is user-scoped (can't see others' progress)

### Data Privacy
- Audit log usernames are shown (transparency requirement)
- If user has `maskFinancials: true`, obfuscate costs in narrative

### AI Prompt Injection Prevention
- Do NOT allow user-provided narrative templates
- Sanitize organization names before passing to AI
- Use parameterized prompts

---

## 📊 Performance Optimization

### Latency Budget: <10 Seconds (Narrative Generation)

**Breakdown**:
1. **Database Queries** (Target: 2s):
   - Query PFA records: 1s
   - Query audit logs: 500ms
   - Aggregate variances: 500ms

2. **AI Processing** (Target: 6s):
   - Generate 5 chapters: 5s
   - Extract takeaways: 1s

3. **Timeline Building** (Target: 500ms):
   - Sort events chronologically
   - Calculate financial impacts

4. **Save to Database** (Target: 500ms):
   - Insert narrative report

### Caching Strategy

```typescript
// Cache generated narratives for 1 hour
const cacheKey = `narrative:${organizationId}:${timestamp}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const narrative = await generateNarrative(organizationId);
await redis.setex(cacheKey, 3600, JSON.stringify(narrative));
```

---

## 🚀 Implementation Checklist

### Backend Tasks

- [ ] **Create `NarrativeExplainerService.ts`**
- [ ] **Implement `explainVariance()` method**
- [ ] **Implement `generateChapters()` with AI**
- [ ] **Implement `buildTimeline()` for visualization**
- [ ] **Implement `extractTakeaways()` summarization**
- [ ] **Add `NarrativeReport` model to Prisma schema**
- [ ] **Create API routes** (`/narrative/generate`, `/narrative/:id`, `/export-pdf`)
- [ ] **Implement PDF generation** (use `pdfkit` or `puppeteer`)

### Frontend Tasks

- [ ] **Create `NarrativeReader.tsx` component**
- [ ] **Implement chapter navigation**
- [ ] **Implement reading progress tracking**
- [ ] **Create `TimelineVisualization` component**
- [ ] **Add PDF export button**
- [ ] **Add responsive design** (mobile chapter pills)

### Testing Tasks

- [ ] **Test 1**: Chapter generation (5 chapters)
- [ ] **Test 2**: Evidence linking (audit logs)
- [ ] **Test 3**: Timeline generation
- [ ] **Test 4**: Takeaways extraction
- [ ] **Test 5**: Reading time estimation
- [ ] **Test 6**: Progress tracking
- [ ] **Test 7**: PDF export

---

## 🎯 Acceptance Criteria

✅ **AI generates 5-chapter narrative from variance data**
✅ **Each chapter includes evidence from audit logs**
✅ **Timeline visualization shows events chronologically**
✅ **Key takeaways and recommendations are actionable**
✅ **Reading progress is saved and restored**
✅ **PDF export includes narrative + timeline**
✅ **Narrative generation completes in <10 seconds**
✅ **Only BEO users can access narratives**

---

**End of Prompt Bundle: Task 8.2 - Narrative Variance Generator**

**Status**: Ready for Execution by `ai-systems-architect`
**Estimated Completion**: 0.5 days
**Next Task**: 8.3 - Asset Arbitrage Detector

---

# Phase 8 Task 8.3: Asset Arbitrage Detector (UC 23) - Complete Prompt Bundle

**Agent Assignment**: `ai-systems-architect`
**Estimated Duration**: 0.5 days
**Status**: Ready for Execution
**Dependencies**: Phase 6 Complete (AI Foundation)

---

## 🎯 Executive Summary

**Mission**: Implement an AI-powered cross-organization asset analysis system that detects when the same equipment type is being rented multiple times across different projects, and recommends consolidation opportunities to reduce costs.

**Business Value**:
- **Cost Savings**: Detect 20-40% savings opportunities through equipment sharing
- **Portfolio Optimization**: Identify redundant rentals across all organizations
- **Feasibility Scoring**: AI evaluates logistics, compatibility, and transport costs
- **Actionable Recommendations**: One-click transfer proposals

**Key Deliverables**:
1. `ArbitrageDetectorService.ts` - Cross-org equipment analysis
2. `ArbitrageOpportunities.tsx` - Opportunity cards with feasibility scores
3. Equipment idle period detection (time gaps between projects)
4. Transport cost calculator (distance-based feasibility)
5. Compatibility checker (equipment specs matching)

---

## 📋 Context & Requirements

### Use Case 23: Cross-Organization Asset Arbitrage

**User Story**:
> As a **BEO Portfolio Manager**,
> I want to **detect when multiple projects are renting the same equipment type**,
> so that I can **consolidate rentals and transfer equipment between sites** to save costs.

**Key Features**:

1. **Duplicate Equipment Detection**:
   - Find same equipment category rented across multiple orgs
   - Example: "3 projects renting 150T mobile cranes"
   - Filter by: Date overlap, geographic proximity, equipment specs

2. **Idle Period Analysis**:
   - Detect equipment idle windows: "HOLNG crane idle Dec 5-28 (23 days)"
   - Match idle periods with other project needs
   - Example: "RIO needs crane Dec 10-25 → 15-day overlap"

3. **Feasibility Scoring** (AI-powered):
   - **Compatibility** (40%): Specs match, capacity meets requirements
   - **Logistics** (30%): Transport distance <50 miles = high feasibility
   - **Cost Savings** (30%): Rental cost vs. transport cost

4. **Transport Cost Calculator**:
   - Distance-based: $2/mile for cranes, $1/mile for smaller equipment
   - Example: 40 miles × $2 = $80 transport cost
   - Compare to rental cost: $8,500 savings vs. $80 transport = 99% savings

5. **One-Click Transfer Proposals**:
   - Generate transfer request with pre-filled details
   - Stakeholder notification: "HOLNG PM → RIO PM"
   - Approval workflow

---

## 🛠️ Technical Specifications

### Backend Implementation

**File**: `backend/src/services/ai/ArbitrageDetectorService.ts`

```typescript
export class ArbitrageDetectorService {
  /**
   * Detect cross-organization equipment rental arbitrage opportunities
   *
   * Algorithm:
   * 1. Query all PFA records across organizations (BEO scope)
   * 2. Group by equipment category
   * 3. Find rentals with overlapping dates
   * 4. Calculate idle periods (gaps between start/end dates)
   * 5. Match idle equipment with other project needs
   * 6. Score feasibility (compatibility, logistics, cost savings)
   * 7. Rank opportunities by total potential savings
   */
  async detectOpportunities(params: {
    userId: string;
  }): Promise<{
    opportunities: Array<{
      id: string;
      type: 'idle_transfer' | 'duplicate_rental' | 'consolidation';
      title: string; // e.g., "Idle Equipment Transfer: HOLNG → RIO"
      description: string;
      potentialSavings: number; // $ amount
      feasibilityScore: number; // 0-100
      sourceOrganization: string;
      targetOrganization: string;
      equipment: {
        category: string;
        specs: string;
        idlePeriod?: { start: Date; end: Date };
      };
      logistics: {
        distance: number; // Miles
        transportCost: number;
      };
      pros: string[];
      cons: string[];
    }>;
    totalSavings: number;
  }>;

  /**
   * Calculate feasibility score
   *
   * Scoring Formula:
   * - Compatibility (40%): Specs match, capacity adequate
   * - Logistics (30%): Distance <50 miles = 100%, >200 miles = 0%
   * - Cost Savings (30%): Savings ratio (savings / transport cost)
   */
  private calculateFeasibility(opportunity: any): {
    score: number;
    breakdown: {
      compatibility: number;
      logistics: number;
      costSavings: number;
    };
  };

  /**
   * Find idle equipment periods
   *
   * Logic:
   * - Query PFA records with forecastEnd < today (completed)
   * - Find gaps where equipment not scheduled
   * - Example: Crane ends Nov 25, next need is Dec 15 → 20-day idle window
   */
  private findIdlePeriods(organizationId: string): Promise<Array<{
    pfaId: string;
    category: string;
    idleStart: Date;
    idleEnd: Date;
    idleDays: number;
  }>>;

  /**
   * Match idle equipment with other project needs
   *
   * Cross-reference:
   * - Org A has idle crane Dec 5-28
   * - Org B needs crane Dec 10-25
   * - Overlap: 15 days → potential transfer
   */
  private matchIdleWithNeeds(idlePeriods: any[], pfaRecords: any[]): any[];

  /**
   * Calculate transport cost based on distance
   *
   * Rates:
   * - Cranes: $2/mile
   * - Scaffolds: $0.50/mile
   * - Generators: $1/mile
   * - Default: $1/mile
   */
  private calculateTransportCost(category: string, distance: number): number;

  /**
   * Get geographic distance between organizations
   *
   * Uses organization.location field (lat/lon)
   * Haversine formula for distance calculation
   */
  private getDistance(org1Id: string, org2Id: string): Promise<number>;
}
```

**Database Schema Updates**:

```prisma
model Organization {
  id       String  @id
  name     String
  // Add location for distance calculation
  location Json?   // { lat: number, lon: number, address: string }
}

model ArbitrageOpportunity {
  id                   String   @id @default(cuid())
  type                 String   // 'idle_transfer', 'duplicate_rental', 'consolidation'
  sourceOrganizationId String
  targetOrganizationId String
  potentialSavings     Float
  feasibilityScore     Float
  status               String   @default("pending") // pending, approved, rejected, completed
  createdAt            DateTime @default(now())
  createdBy            String

  // Relations
  sourceOrg            Organization @relation("SourceOrg", fields: [sourceOrganizationId], references: [id])
  targetOrg            Organization @relation("TargetOrg", fields: [targetOrganizationId], references: [id])
  creator              User         @relation(fields: [createdBy], references: [id])
}
```

**API Endpoints**:

```typescript
// GET /api/beo/arbitrage/opportunities
router.get('/opportunities', requirePermission('perm_ViewAllOrgs'), async (req, res) => {
  const opportunities = await arbitrageDetectorService.detectOpportunities({
    userId: req.user!.id,
  });
  res.json(opportunities);
});

// POST /api/beo/arbitrage/propose-transfer
router.post('/propose-transfer', requirePermission('perm_ViewAllOrgs'), async (req, res) => {
  const { opportunityId } = req.body;

  // Create transfer proposal
  const proposal = await prisma.arbitrageOpportunity.update({
    where: { id: opportunityId },
    data: { status: 'proposed' },
  });

  // Notify stakeholders (source PM and target PM)
  await notifyTransferProposal(proposal);

  res.json(proposal);
});
```

---

### Frontend Implementation

**File**: `components/beo/ArbitrageOpportunities.tsx`

```tsx
import { useState, useEffect } from 'react';
import { TrendingDown, MapPin, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface Opportunity {
  id: string;
  type: 'idle_transfer' | 'duplicate_rental' | 'consolidation';
  title: string;
  description: string;
  potentialSavings: number;
  feasibilityScore: number;
  sourceOrganization: string;
  targetOrganization: string;
  equipment: {
    category: string;
    specs: string;
    idlePeriod?: { start: Date; end: Date };
  };
  logistics: {
    distance: number;
    transportCost: number;
  };
  pros: string[];
  cons: string[];
}

export function ArbitrageOpportunities() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [totalSavings, setTotalSavings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadOpportunities();
  }, []);

  const loadOpportunities = async () => {
    setLoading(true);
    try {
      const result = await apiClient.getArbitrageOpportunities();
      setOpportunities(result.opportunities);
      setTotalSavings(result.totalSavings);
    } catch (error) {
      console.error('Failed to load arbitrage opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  const proposeTransfer = async (opportunityId: string) => {
    if (!confirm('Send transfer proposal to project managers?')) return;

    try {
      await apiClient.proposeArbitrageTransfer(opportunityId);
      alert('Transfer proposal sent to stakeholders');
      loadOpportunities(); // Reload to update status
    } catch (error) {
      alert('Failed to propose transfer');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="arbitrage-opportunities max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">💡 Cost Optimization Opportunities</h1>
        <p className="text-gray-600">
          AI detected <span className="font-semibold text-blue-600">{opportunities.length} opportunities</span> to save{' '}
          <span className="font-semibold text-green-600">${totalSavings.toLocaleString()}</span> across your
          portfolio
        </p>
      </div>

      {/* Opportunities List */}
      <div className="space-y-4">
        {opportunities.map((opp) => (
          <div key={opp.id} className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Opportunity Header */}
            <div className="p-6 bg-gradient-to-r from-green-50 to-blue-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl font-bold text-green-600">
                      ${opp.potentialSavings.toLocaleString()}
                    </span>
                    <span className="text-sm text-gray-600">Potential Savings</span>
                  </div>

                  <h3 className="text-xl font-semibold text-gray-900 mb-1">{opp.title}</h3>
                  <p className="text-gray-700">{opp.description}</p>

                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {opp.sourceOrganization} → {opp.targetOrganization}
                    </span>
                    <span>{opp.logistics.distance} miles</span>
                    <span>Transport: ${opp.logistics.transportCost}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="mb-2">
                    <p className="text-xs text-gray-600 mb-1">Feasibility</p>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            opp.feasibilityScore >= 80
                              ? 'bg-green-500'
                              : opp.feasibilityScore >= 60
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${opp.feasibilityScore}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-semibold">{opp.feasibilityScore}%</span>
                    </div>
                  </div>

                  {opp.equipment.idlePeriod && (
                    <p className="text-xs text-gray-600">
                      Idle: {new Date(opp.equipment.idlePeriod.start).toLocaleDateString()} -{' '}
                      {new Date(opp.equipment.idlePeriod.end).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Equipment Details */}
            <div className="px-6 py-4 border-b bg-gray-50">
              <p className="text-sm">
                <span className="font-medium">Equipment:</span> {opp.equipment.category}
              </p>
              <p className="text-sm text-gray-600">{opp.equipment.specs}</p>
            </div>

            {/* Pros/Cons Toggle */}
            <div className="px-6 py-4">
              <button
                onClick={() => setExpandedId(expandedId === opp.id ? null : opp.id)}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="font-medium text-gray-900">Feasibility Analysis</span>
                {expandedId === opp.id ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>

              {expandedId === opp.id && (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  {/* Pros */}
                  <div>
                    <h4 className="text-sm font-medium text-green-700 mb-2">✅ Pros</h4>
                    <ul className="space-y-1">
                      {opp.pros.map((pro, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{pro}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Cons */}
                  <div>
                    <h4 className="text-sm font-medium text-red-700 mb-2">⚠️ Cons</h4>
                    <ul className="space-y-1">
                      {opp.cons.map((con, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <span>{con}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="px-6 py-4 bg-gray-50 flex gap-3">
              <button
                onClick={() => proposeTransfer(opp.id)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition flex items-center gap-2"
              >
                <TrendingDown className="w-4 h-4" />
                Propose Transfer
              </button>
              <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition">
                View Details
              </button>
              <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition">
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {opportunities.length === 0 && (
        <div className="text-center p-12 bg-white rounded-lg shadow-md">
          <p className="text-gray-600 text-lg">No arbitrage opportunities detected</p>
          <p className="text-sm text-gray-500 mt-2">AI is continuously monitoring for cost savings</p>
        </div>
      )}
    </div>
  );
}
```

---

## 🧪 Testing Requirements

```typescript
describe('Use Case 23: Asset Arbitrage Detector', () => {
  let beoUser: User;

  beforeEach(async () => {
    // Create BEO user
    beoUser = await prisma.user.create({
      data: {
        username: 'beo-arbitrage-test',
        userOrganizations: {
          create: { organizationId: 'ALL_ORGS', capabilities: ['perm_ViewAllOrgs'] },
        },
      },
    });

    // Create organizations with location data
    await prisma.organization.createMany({
      data: [
        {
          id: 'HOLNG',
          name: 'Houston LNG',
          location: JSON.stringify({ lat: 29.7604, lon: -95.3698, address: 'Houston, TX' }),
        },
        {
          id: 'RIO',
          name: 'Rio Grande',
          location: JSON.stringify({ lat: 29.4241, lon: -98.4936, address: 'San Antonio, TX' }),
        },
      ],
    });

    // Seed duplicate rentals
    await prisma.pfaRecord.createMany({
      data: [
        {
          id: 'holng-crane-1',
          organizationId: 'HOLNG',
          category: 'Crane - Mobile 200T',
          forecastStart: new Date('2025-12-01'),
          forecastEnd: new Date('2025-12-15'),
          forecastCost: 50000,
          source: 'Rental',
        },
        {
          id: 'rio-crane-1',
          organizationId: 'RIO',
          category: 'Crane - Mobile 200T',
          forecastStart: new Date('2025-12-10'),
          forecastEnd: new Date('2025-12-25'),
          forecastCost: 45000,
          source: 'Rental',
        },
      ],
    });
  });

  // Test 1: Detect idle transfer opportunity
  it('should detect idle equipment transfer opportunity', async () => {
    const response = await request(app)
      .get('/api/beo/arbitrage/opportunities')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`);

    expect(response.status).toBe(200);
    expect(response.body.opportunities.length).toBeGreaterThan(0);

    const opportunity = response.body.opportunities[0];
    expect(opportunity.type).toBe('idle_transfer');
    expect(opportunity.sourceOrganization).toBe('HOLNG');
    expect(opportunity.targetOrganization).toBe('RIO');
  });

  // Test 2: Calculate feasibility score
  it('should calculate feasibility score correctly', async () => {
    const response = await request(app)
      .get('/api/beo/arbitrage/opportunities')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`);

    const opportunity = response.body.opportunities[0];
    expect(opportunity.feasibilityScore).toBeGreaterThan(70); // High feasibility (short distance)
    expect(opportunity.potentialSavings).toBeGreaterThan(0);
  });

  // Test 3: Calculate transport cost
  it('should calculate transport cost based on distance', async () => {
    const response = await request(app)
      .get('/api/beo/arbitrage/opportunities')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`);

    const opportunity = response.body.opportunities[0];
    // Houston to San Antonio: ~200 miles × $2/mile = $400
    expect(opportunity.logistics.transportCost).toBeGreaterThan(300);
    expect(opportunity.logistics.transportCost).toBeLessThan(500);
  });

  // Test 4: Propose transfer
  it('should create transfer proposal', async () => {
    const oppsRes = await request(app)
      .get('/api/beo/arbitrage/opportunities')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`);

    const proposalRes = await request(app)
      .post('/api/beo/arbitrage/propose-transfer')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({ opportunityId: oppsRes.body.opportunities[0].id });

    expect(proposalRes.status).toBe(200);
    expect(proposalRes.body.status).toBe('proposed');
  });
});
```

---

## 🚀 Implementation Checklist

### Backend Tasks
- [ ] Create `ArbitrageDetectorService.ts`
- [ ] Implement `detectOpportunities()` method
- [ ] Implement `calculateFeasibility()` scoring
- [ ] Implement `findIdlePeriods()` analysis
- [ ] Implement `getDistance()` calculator (Haversine)
- [ ] Add `location` field to Organization model
- [ ] Create `ArbitrageOpportunity` model
- [ ] Create API endpoints

### Frontend Tasks
- [ ] Create `ArbitrageOpportunities.tsx` component
- [ ] Implement opportunity cards with feasibility bars
- [ ] Implement pros/cons expansion
- [ ] Add transfer proposal modal
- [ ] Add dismiss opportunity action

### Testing Tasks
- [ ] Test idle transfer detection
- [ ] Test feasibility calculation
- [ ] Test transport cost calculation
- [ ] Test transfer proposal creation

---

## 🎯 Acceptance Criteria

✅ **AI detects duplicate equipment rentals across organizations**
✅ **Idle periods are identified and matched with other project needs**
✅ **Feasibility score accurately reflects compatibility, logistics, and cost**
✅ **Transport cost is calculated based on distance**
✅ **One-click transfer proposals notify stakeholders**
✅ **Only BEO users can access arbitrage opportunities**

---

**End of Prompt Bundle: Task 8.3 - Asset Arbitrage Detector**

**Status**: Ready for Execution by `ai-systems-architect`
**Estimated Completion**: 0.5 days
**Next Task**: 8.4 - Vendor Pricing Watchdog

---

# Phase 8 Task 8.4: Vendor Pricing Watchdog (UC 24) - Complete Prompt Bundle

**Agent Assignment**: `ai-systems-architect`
**Estimated Duration**: 0.5 days
**Status**: Ready for Execution
**Dependencies**: Phase 6 Complete (AI Foundation)

---

## 🎯 Executive Summary

**Mission**: Implement an AI-powered vendor pricing analysis system that monitors equipment rental rates across organizations, detects pricing discrepancies, and alerts BEO users when vendors charge different rates for identical equipment.

**Business Value**:
- **Price Discovery**: Identify 10-30% pricing discrepancies across vendors
- **Negotiation Leverage**: "Vendor X charges 20% less for same crane → renegotiate"
- **Vendor Performance**: Track rate changes over time, flag suspicious increases
- **Automated Alerts**: Real-time notifications when pricing anomalies detected

**Key Deliverables**:
1. `VendorPricingWatchdogService.ts` - Pricing anomaly detection
2. `VendorPricingDashboard.tsx` - Comparative pricing visualization
3. Price alert notifications (email + in-app)
4. Historical pricing trends (detect 10%+ increases month-over-month)
5. Vendor comparison table (sort by best price per equipment type)

---

## 📋 Context & Requirements

### Use Case 24: Vendor Pricing Watchdog

**User Story**:
> As a **BEO Procurement Manager**,
> I want to **compare vendor pricing across all organizations**,
> so that I can **negotiate better rates** and **switch vendors** when overcharged.

**Key Features**:

1. **Cross-Organization Price Comparison**:
   - Compare monthly rates for same equipment category
   - Example: "Crane - Mobile 200T" rates across 5 vendors
   - Highlight outliers: "Vendor X charges $12K/mo, Vendor Y charges $9K/mo (25% cheaper)"

2. **Pricing Anomaly Detection**:
   - AI flags when vendor charges >15% more than market average
   - Alert: "Vendor ABC charging HOLNG 20% more than RIO for identical crane"
   - Recommended action: "Renegotiate or switch to Vendor XYZ"

3. **Historical Pricing Trends**:
   - Track vendor rate changes month-over-month
   - Flag suspicious increases: "Vendor X raised crane rates 18% in Nov"
   - Detect seasonal patterns: "Generator prices spike 30% in winter"

4. **Vendor Performance Scorecard**:
   - Rank vendors by: Price competitiveness, rate stability, equipment availability
   - Example scorecard:
     - Vendor A: 95/100 (Best price, stable rates)
     - Vendor B: 70/100 (Average price, rate volatility)

5. **Automated Alert Notifications**:
   - Email: "Weekly Vendor Pricing Report - 3 anomalies detected"
   - In-app: "⚠️ Vendor ABC price increased 15% for cranes"
   - Slack/Teams integration (optional)

---

## 🛠️ Technical Specifications

### Backend Implementation

**File**: `backend/src/services/ai/VendorPricingWatchdogService.ts`

```typescript
export class VendorPricingWatchdogService {
  /**
   * Analyze vendor pricing across all organizations
   *
   * Algorithm:
   * 1. Query all PFA records with source = 'Rental'
   * 2. Group by equipment category and vendor
   * 3. Calculate average monthly rate per vendor per category
   * 4. Detect pricing anomalies (>15% deviation from market avg)
   * 5. Track month-over-month rate changes
   * 6. Generate vendor performance scorecard
   */
  async analyzeVendorPricing(): Promise<{
    pricingData: Array<{
      category: string;
      vendors: Array<{
        vendorName: string;
        avgMonthlyRate: number;
        deviationFromMarket: number; // % difference from market avg
        priceRank: number; // 1 = cheapest, N = most expensive
        rateStability: number; // 0-100 score (100 = stable, 0 = volatile)
        equipmentCount: number; // Number of active rentals
      }>;
      marketAvg: number;
    }>;
    anomalies: Array<{
      id: string;
      type: 'overpriced' | 'suspicious_increase' | 'market_shift';
      severity: 'high' | 'medium' | 'low';
      vendorName: string;
      category: string;
      organizationId: string;
      currentRate: number;
      marketRate: number;
      deviationPercent: number;
      recommendation: string;
    }>;
    vendorScorecard: Array<{
      vendorName: string;
      overallScore: number; // 0-100
      priceCompetitiveness: number; // 0-100
      rateStability: number; // 0-100
      equipmentCoverage: number; // 0-100 (how many categories they serve)
    }>;
  }>;

  /**
   * Detect pricing anomalies
   *
   * Anomaly Types:
   * - Overpriced: Vendor charges >15% above market avg
   * - Suspicious Increase: Rate increased >10% month-over-month
   * - Market Shift: All vendors raised prices (industry-wide trend)
   */
  private detectAnomalies(pricingData: any[]): Anomaly[];

  /**
   * Calculate vendor performance scorecard
   *
   * Scoring:
   * - Price Competitiveness (40%): Lower rates = higher score
   * - Rate Stability (30%): Consistent rates = higher score
   * - Equipment Coverage (30%): More categories = higher score
   */
  private calculateVendorScorecard(pricingData: any[]): VendorScore[];

  /**
   * Track month-over-month rate changes
   *
   * Logic:
   * - Query historical PFA records (last 6 months)
   * - Group by vendor + category + month
   * - Calculate MoM change percentage
   * - Flag increases >10%
   */
  private trackRateChanges(vendorName: string, category: string): Promise<{
    currentRate: number;
    previousRate: number;
    changePercent: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }>;

  /**
   * Send pricing alert notifications
   *
   * Triggers:
   * - Daily: Check for new anomalies
   * - Weekly: Send digest report to BEO users
   * - Real-time: Alert when vendor raises rates >15%
   */
  async sendPricingAlerts(): Promise<void>;
}

interface Anomaly {
  id: string;
  type: 'overpriced' | 'suspicious_increase' | 'market_shift';
  severity: 'high' | 'medium' | 'low';
  vendorName: string;
  category: string;
  organizationId: string;
  currentRate: number;
  marketRate: number;
  deviationPercent: number;
  recommendation: string;
}

interface VendorScore {
  vendorName: string;
  overallScore: number;
  priceCompetitiveness: number;
  rateStability: number;
  equipmentCoverage: number;
}
```

**Database Schema Updates**:

```prisma
model PfaRecord {
  // ... existing fields ...

  // Add vendor tracking
  vendorName       String?
  monthlyRate      Float?

  @@index([vendorName, category]) // For pricing queries
}

model VendorPricingSnapshot {
  id               String   @id @default(cuid())
  vendorName       String
  category         String
  avgMonthlyRate   Float
  equipmentCount   Int
  organizationIds  Json     // Array of org IDs using this vendor
  snapshotDate     DateTime @default(now())

  @@index([vendorName, category, snapshotDate])
}

model PricingAnomaly {
  id                   String   @id @default(cuid())
  type                 String   // 'overpriced', 'suspicious_increase', 'market_shift'
  severity             String   // 'high', 'medium', 'low'
  vendorName           String
  category             String
  organizationId       String
  currentRate          Float
  marketRate           Float
  deviationPercent     Float
  recommendation       String
  status               String   @default("active") // active, resolved, dismissed
  detectedAt           DateTime @default(now())
  resolvedAt           DateTime?

  @@index([vendorName, status])
}
```

**API Endpoints**:

```typescript
// GET /api/beo/vendor-pricing/analysis
router.get('/analysis', requirePermission('perm_ViewAllOrgs'), async (req, res) => {
  const analysis = await vendorPricingWatchdogService.analyzeVendorPricing();
  res.json(analysis);
});

// GET /api/beo/vendor-pricing/anomalies
router.get('/anomalies', requirePermission('perm_ViewAllOrgs'), async (req, res) => {
  const anomalies = await prisma.pricingAnomaly.findMany({
    where: { status: 'active' },
    orderBy: { detectedAt: 'desc' },
  });
  res.json(anomalies);
});

// POST /api/beo/vendor-pricing/dismiss-anomaly/:id
router.post('/dismiss-anomaly/:id', requirePermission('perm_ViewAllOrgs'), async (req, res) => {
  const anomaly = await prisma.pricingAnomaly.update({
    where: { id: req.params.id },
    data: { status: 'dismissed' },
  });
  res.json(anomaly);
});

// GET /api/beo/vendor-pricing/scorecard
router.get('/scorecard', requirePermission('perm_ViewAllOrgs'), async (req, res) => {
  const analysis = await vendorPricingWatchdogService.analyzeVendorPricing();
  res.json(analysis.vendorScorecard);
});
```

---

### Frontend Implementation

**File**: `components/beo/VendorPricingDashboard.tsx`

```tsx
import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Check } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface VendorPricingData {
  category: string;
  vendors: Array<{
    vendorName: string;
    avgMonthlyRate: number;
    deviationFromMarket: number;
    priceRank: number;
    rateStability: number;
    equipmentCount: number;
  }>;
  marketAvg: number;
}

interface Anomaly {
  id: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  vendorName: string;
  category: string;
  organizationId: string;
  currentRate: number;
  marketRate: number;
  deviationPercent: number;
  recommendation: string;
}

export function VendorPricingDashboard() {
  const [pricingData, setPricingData] = useState<VendorPricingData[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPricingAnalysis();
  }, []);

  const loadPricingAnalysis = async () => {
    setLoading(true);
    try {
      const analysis = await apiClient.getVendorPricingAnalysis();
      setPricingData(analysis.pricingData);
      setAnomalies(analysis.anomalies);
    } catch (error) {
      console.error('Failed to load vendor pricing:', error);
    } finally {
      setLoading(false);
    }
  };

  const dismissAnomaly = async (anomalyId: string) => {
    try {
      await apiClient.dismissPricingAnomaly(anomalyId);
      setAnomalies(anomalies.filter((a) => a.id !== anomalyId));
    } catch (error) {
      alert('Failed to dismiss anomaly');
    }
  };

  if (loading) {
    return <div className="text-center p-12">Loading vendor pricing analysis...</div>;
  }

  return (
    <div className="vendor-pricing-dashboard max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">📊 Vendor Pricing Watchdog</h1>
        <p className="text-gray-600">
          Monitoring <span className="font-semibold">{pricingData.length} equipment categories</span> across{' '}
          <span className="font-semibold text-red-600">{anomalies.length} pricing anomalies detected</span>
        </p>
      </div>

      {/* Pricing Anomalies Alert Section */}
      {anomalies.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-6 mb-6 rounded-r">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-red-900 mb-3">
                ⚠️ {anomalies.length} Pricing Anomalies Detected
              </h2>

              <div className="space-y-3">
                {anomalies.slice(0, 3).map((anomaly) => (
                  <div key={anomaly.id} className="bg-white p-4 rounded shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded ${
                              anomaly.severity === 'high'
                                ? 'bg-red-100 text-red-700'
                                : anomaly.severity === 'medium'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {anomaly.severity.toUpperCase()}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {anomaly.vendorName} - {anomaly.category}
                          </span>
                        </div>

                        <p className="text-sm text-gray-700 mb-2">
                          Charging <span className="font-bold text-red-600">${anomaly.currentRate.toLocaleString()}/mo</span> vs.
                          market avg <span className="font-bold">${anomaly.marketRate.toLocaleString()}/mo</span>
                          <span className="text-red-600 font-bold ml-2">
                            (+{anomaly.deviationPercent}% overpriced)
                          </span>
                        </p>

                        <p className="text-sm text-blue-700">
                          💡 <span className="font-medium">Recommendation:</span> {anomaly.recommendation}
                        </p>
                      </div>

                      <button
                        onClick={() => dismissAnomaly(anomaly.id)}
                        className="ml-4 px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {anomalies.length > 3 && (
                <button className="mt-3 text-sm text-red-700 hover:underline">
                  View all {anomalies.length} anomalies →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Vendor Comparison Tables (by Category) */}
      <div className="space-y-6">
        {pricingData.map((categoryData) => (
          <div key={categoryData.category} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">{categoryData.category}</h3>
              <p className="text-sm text-gray-600">
                Market Average: <span className="font-medium">${categoryData.marketAvg.toLocaleString()}/mo</span>
              </p>
            </div>

            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Rank</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Vendor</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700">Monthly Rate</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700">vs. Market</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700">Rate Stability</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700">Equipment Count</th>
                </tr>
              </thead>
              <tbody>
                {categoryData.vendors
                  .sort((a, b) => a.avgMonthlyRate - b.avgMonthlyRate)
                  .map((vendor, i) => (
                    <tr key={vendor.vendorName} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                            i === 0
                              ? 'bg-green-100 text-green-700'
                              : i === 1
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">{vendor.vendorName}</td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-900">
                        ${vendor.avgMonthlyRate.toLocaleString()}/mo
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span
                          className={`flex items-center justify-end gap-1 ${
                            vendor.deviationFromMarket > 0 ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {vendor.deviationFromMarket > 0 ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                          <span className="font-medium">
                            {vendor.deviationFromMarket > 0 ? '+' : ''}
                            {vendor.deviationFromMarket.toFixed(1)}%
                          </span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                vendor.rateStability >= 80
                                  ? 'bg-green-500'
                                  : vendor.rateStability >= 60
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${vendor.rateStability}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600">{vendor.rateStability}/100</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-gray-700">{vendor.equipmentCount}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 🧪 Testing Requirements

```typescript
describe('Use Case 24: Vendor Pricing Watchdog', () => {
  beforeEach(async () => {
    // Seed PFA records with vendor pricing
    await prisma.pfaRecord.createMany({
      data: [
        {
          id: 'pfa-vendor-a-1',
          organizationId: 'HOLNG',
          vendorName: 'Vendor A',
          category: 'Crane - Mobile 200T',
          monthlyRate: 12000, // Overpriced (market avg: $10K)
          source: 'Rental',
        },
        {
          id: 'pfa-vendor-b-1',
          organizationId: 'RIO',
          vendorName: 'Vendor B',
          category: 'Crane - Mobile 200T',
          monthlyRate: 9000, // Good price
          source: 'Rental',
        },
        {
          id: 'pfa-vendor-c-1',
          organizationId: 'PEMS_Global',
          vendorName: 'Vendor C',
          category: 'Crane - Mobile 200T',
          monthlyRate: 10000, // Market avg
          source: 'Rental',
        },
      ],
    });
  });

  // Test 1: Detect overpriced vendor
  it('should detect vendor charging above market average', async () => {
    const analysis = await vendorPricingWatchdogService.analyzeVendorPricing();

    expect(analysis.anomalies.length).toBeGreaterThan(0);
    const anomaly = analysis.anomalies.find((a) => a.vendorName === 'Vendor A');
    expect(anomaly).toBeTruthy();
    expect(anomaly!.type).toBe('overpriced');
    expect(anomaly!.deviationPercent).toBeCloseTo(20, 1); // +20% above market
  });

  // Test 2: Calculate vendor scorecard
  it('should rank vendors by price competitiveness', async () => {
    const analysis = await vendorPricingWatchdogService.analyzeVendorPricing();

    const vendorB = analysis.vendorScorecard.find((v) => v.vendorName === 'Vendor B');
    const vendorA = analysis.vendorScorecard.find((v) => v.vendorName === 'Vendor A');

    expect(vendorB!.priceCompetitiveness).toBeGreaterThan(vendorA!.priceCompetitiveness);
  });

  // Test 3: Track month-over-month rate changes
  it('should detect suspicious rate increases', async () => {
    // Seed historical snapshot (last month)
    await prisma.vendorPricingSnapshot.create({
      data: {
        vendorName: 'Vendor A',
        category: 'Crane - Mobile 200T',
        avgMonthlyRate: 10000, // Was $10K last month
        equipmentCount: 1,
        organizationIds: JSON.stringify(['HOLNG']),
        snapshotDate: new Date('2025-10-01'),
      },
    });

    const analysis = await vendorPricingWatchdogService.analyzeVendorPricing();

    const anomaly = analysis.anomalies.find(
      (a) => a.type === 'suspicious_increase' && a.vendorName === 'Vendor A'
    );
    expect(anomaly).toBeTruthy();
    expect(anomaly!.recommendation).toContain('renegotiate');
  });
});
```

---

## 🚀 Implementation Checklist

### Backend Tasks
- [ ] Create `VendorPricingWatchdogService.ts`
- [ ] Implement `analyzeVendorPricing()` method
- [ ] Implement `detectAnomalies()` logic
- [ ] Implement `calculateVendorScorecard()` scoring
- [ ] Implement `trackRateChanges()` MoM analysis
- [ ] Add `vendorName` field to PfaRecord model
- [ ] Create `VendorPricingSnapshot` model
- [ ] Create `PricingAnomaly` model
- [ ] Create API endpoints
- [ ] Implement email alert service

### Frontend Tasks
- [ ] Create `VendorPricingDashboard.tsx` component
- [ ] Implement anomaly alert section
- [ ] Implement vendor comparison tables
- [ ] Add dismiss anomaly action
- [ ] Add vendor scorecard view

### Testing Tasks
- [ ] Test overpriced vendor detection
- [ ] Test vendor scorecard calculation
- [ ] Test MoM rate change tracking
- [ ] Test anomaly dismissal

---

## 🎯 Acceptance Criteria

✅ **AI detects vendors charging >15% above market average**
✅ **Vendor scorecard ranks vendors by price, stability, coverage**
✅ **Month-over-month rate increases >10% are flagged**
✅ **Anomaly alerts sent via email and in-app notifications**
✅ **BEO users can dismiss false positive anomalies**
✅ **Pricing data refreshes daily (background job)**

---

**End of Prompt Bundle: Task 8.4 - Vendor Pricing Watchdog**

**Status**: Ready for Execution by `ai-systems-architect`
**Estimated Completion**: 0.5 days
**Next Task**: 8.5 - Multiverse Scenario Simulator

---

# Phase 8 Task 8.5: Multiverse Scenario Simulator (UC 25) - Complete Prompt Bundle

**Agent Assignment**: `ai-systems-architect`
**Estimated Duration**: 1 day
**Status**: Ready for Execution
**Dependencies**: Phase 6 Complete (AI Foundation), Phase 8.1-8.4 Complete

---

## 🎯 Executive Summary

**Mission**: Implement an AI-powered what-if scenario simulator that allows BEO executives to model hypothetical changes to equipment schedules, vendor selections, or project timelines, and visualize the financial and operational impacts across the entire portfolio.

**Business Value**:
- **Risk Mitigation**: Model "what if weather delays all projects by 30 days?"
- **Strategic Planning**: Simulate vendor switches, equipment consolidation, timeline shifts
- **Monte Carlo Analysis**: Run 1,000+ scenarios to identify P50/P90 variance outcomes
- **Board Presentation**: Interactive scenario builder for executive decision-making

**Key Deliverables**:
1. `ScenarioSimulatorService.ts` - What-if analysis engine with Monte Carlo simulation
2. `ScenarioBuilder.tsx` - Interactive scenario configuration UI
3. Impact visualization dashboard (budget, timeline, resource utilization)
4. Scenario comparison table (compare 3-5 scenarios side-by-side)
5. PDF export for board presentations

---

## 📋 Context & Requirements

### Use Case 25: Multiverse Scenario Simulator

**User Story**:
> As a **CFO** (BEO user),
> I want to **simulate hypothetical changes to project schedules and vendor selections**,
> so that I can **understand financial and operational impacts before making decisions**.

**Key Features**:

1. **What-If Scenario Types**:
   - **Timeline Shift**: "What if all rentals shift by +30 days?"
   - **Vendor Switch**: "What if we switch all cranes from Vendor A to Vendor B?"
   - **Equipment Consolidation**: "What if we consolidate 3 cranes into 2?"
   - **Budget Cut**: "What if we reduce equipment budget by 15%?"
   - **Weather Delay**: "What if winter weather delays all projects by 2 weeks?"

2. **Interactive Scenario Builder**:
   - Step 1: Select scenario type (dropdown)
   - Step 2: Configure parameters (e.g., shift days, vendor selection)
   - Step 3: Select organizations to apply scenario (all or subset)
   - Step 4: Run simulation
   - Step 5: View impact dashboard

3. **Impact Visualization**:
   - **Financial Impact**: Total budget change, variance delta
   - **Timeline Impact**: Gantt chart showing shifted schedules
   - **Resource Utilization**: Equipment overlap analysis
   - **Risk Assessment**: Probability distribution of outcomes (Monte Carlo)

4. **Monte Carlo Simulation**:
   - Run 1,000 iterations with randomized variations
   - Example: Weather delay varies from 10-30 days (normal distribution)
   - Output: P50 (median), P90 (worst case), P10 (best case)

5. **Scenario Comparison**:
   - Compare up to 5 scenarios side-by-side
   - Example: "Vendor Switch" vs. "Equipment Consolidation" vs. "Timeline Shift"
   - Highlight best scenario (highest savings, lowest risk)

6. **Export & Presentation**:
   - Export scenario impact as PDF
   - Include charts: Budget impact, timeline visualization, risk distribution
   - Board-ready format with executive summary

---

## 🛠️ Technical Specifications

### Backend Implementation

**File**: `backend/src/services/ai/ScenarioSimulatorService.ts`

```typescript
export class ScenarioSimulatorService {
  /**
   * Simulate what-if scenario and calculate impacts
   *
   * Algorithm:
   * 1. Clone current PFA data (baseline)
   * 2. Apply scenario transformations (shift dates, switch vendors, etc.)
   * 3. Recalculate costs, timelines, resource utilization
   * 4. Compare scenario result vs. baseline
   * 5. Generate impact summary
   */
  async simulateScenario(params: {
    userId: string;
    scenarioType: 'timeline_shift' | 'vendor_switch' | 'consolidation' | 'budget_cut' | 'weather_delay';
    organizationIds: string[]; // 'ALL' or specific orgs
    parameters: {
      shiftDays?: number; // For timeline_shift
      targetVendor?: string; // For vendor_switch
      budgetReductionPercent?: number; // For budget_cut
      weatherDelayRange?: { min: number; max: number }; // For Monte Carlo
    };
    runMonteCarlo?: boolean; // Default: false
    iterations?: number; // Default: 1000 (for Monte Carlo)
  }): Promise<{
    scenarioId: string;
    scenarioType: string;
    baselineMetrics: {
      totalCost: number;
      totalDuration: number; // Days
      equipmentCount: number;
    };
    scenarioMetrics: {
      totalCost: number;
      totalDuration: number;
      equipmentCount: number;
    };
    impact: {
      costDelta: number; // $ change
      costDeltaPercent: number; // % change
      durationDelta: number; // Days change
      equipmentDelta: number; // Count change
    };
    riskAnalysis?: {
      p10: number; // Best case (10th percentile)
      p50: number; // Median
      p90: number; // Worst case (90th percentile)
      probabilityDistribution: Array<{ cost: number; probability: number }>;
    };
    affectedRecords: number; // Count of PFA records changed
    timeline: TimelineComparison; // Baseline vs. Scenario Gantt
  }>;

  /**
   * Apply scenario transformations to PFA data
   *
   * Transformations:
   * - Timeline Shift: Add N days to forecastStart/forecastEnd
   * - Vendor Switch: Replace vendorName, recalculate monthlyRate
   * - Consolidation: Merge overlapping rentals, reduce quantity
   * - Budget Cut: Reduce monthlyRate by X%, or remove low-priority items
   * - Weather Delay: Random delay (normal distribution)
   */
  private applyScenarioTransformations(
    pfaRecords: PfaRecord[],
    scenarioType: string,
    parameters: any
  ): PfaRecord[];

  /**
   * Run Monte Carlo simulation (1000 iterations)
   *
   * Logic:
   * - For each iteration, apply random variation to parameters
   * - Example: Weather delay varies from 10-30 days (μ=20, σ=5)
   * - Calculate cost for each iteration
   * - Aggregate results: P10, P50, P90
   */
  private runMonteCarloSimulation(
    pfaRecords: PfaRecord[],
    scenarioType: string,
    parameters: any,
    iterations: number
  ): Promise<{
    p10: number;
    p50: number;
    p90: number;
    probabilityDistribution: Array<{ cost: number; probability: number }>;
  }>;

  /**
   * Generate timeline comparison (baseline vs. scenario)
   *
   * Output:
   * - Gantt chart data showing:
   *   - Baseline bars (blue)
   *   - Scenario bars (orange)
   *   - Delta arrows showing shifts
   */
  private generateTimelineComparison(
    baselinePfa: PfaRecord[],
    scenarioPfa: PfaRecord[]
  ): TimelineComparison;

  /**
   * Save scenario for future comparison
   */
  async saveScenario(scenarioResult: any): Promise<void>;

  /**
   * Compare multiple scenarios side-by-side
   */
  async compareScenarios(scenarioIds: string[]): Promise<{
    scenarios: Array<{
      scenarioId: string;
      scenarioType: string;
      impact: {
        costDelta: number;
        costDeltaPercent: number;
        durationDelta: number;
      };
    }>;
    recommendation: string; // AI-generated recommendation for best scenario
  }>;
}

interface TimelineComparison {
  baselineStart: Date;
  baselineEnd: Date;
  scenarioStart: Date;
  scenarioEnd: Date;
  shiftDays: number;
  ganttData: Array<{
    pfaId: string;
    category: string;
    baselineBar: { start: Date; end: Date };
    scenarioBar: { start: Date; end: Date };
    delta: number; // Days shifted
  }>;
}
```

**Database Schema Updates**:

```prisma
model ScenarioSimulation {
  id                  String   @id @default(cuid())
  scenarioId          String   @unique
  scenarioType        String
  organizationIds     Json     // Array of org IDs
  parameters          Json     // Scenario configuration
  baselineMetrics     Json
  scenarioMetrics     Json
  impact              Json
  riskAnalysis        Json?    // Monte Carlo results
  timeline            Json     // TimelineComparison
  createdAt           DateTime @default(now())
  createdBy           String

  // Relations
  creator             User     @relation(fields: [createdBy], references: [id])

  @@index([createdBy, createdAt])
}
```

**API Endpoints**:

```typescript
// POST /api/beo/scenario/simulate
router.post('/simulate', requirePermission('perm_ViewAllOrgs'), async (req, res) => {
  const { scenarioType, organizationIds, parameters, runMonteCarlo, iterations } = req.body;

  const result = await scenarioSimulatorService.simulateScenario({
    userId: req.user!.id,
    scenarioType,
    organizationIds,
    parameters,
    runMonteCarlo,
    iterations,
  });

  // Auto-save scenario
  await scenarioSimulatorService.saveScenario(result);

  res.json(result);
});

// GET /api/beo/scenario/list
router.get('/list', requirePermission('perm_ViewAllOrgs'), async (req, res) => {
  const scenarios = await prisma.scenarioSimulation.findMany({
    where: { createdBy: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  res.json(scenarios);
});

// POST /api/beo/scenario/compare
router.post('/compare', requirePermission('perm_ViewAllOrgs'), async (req, res) => {
  const { scenarioIds } = req.body;

  const comparison = await scenarioSimulatorService.compareScenarios(scenarioIds);
  res.json(comparison);
});

// GET /api/beo/scenario/:scenarioId/export-pdf
router.get('/:scenarioId/export-pdf', async (req, res) => {
  const scenario = await prisma.scenarioSimulation.findUnique({
    where: { scenarioId: req.params.scenarioId },
  });

  const pdf = await generateScenarioPDF(scenario);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Scenario_${scenario!.scenarioType}.pdf"`);
  res.send(pdf);
});
```

---

### Frontend Implementation

**File**: `components/beo/ScenarioBuilder.tsx`

```tsx
import { useState } from 'react';
import { Play, Download, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface ScenarioResult {
  scenarioId: string;
  scenarioType: string;
  baselineMetrics: { totalCost: number; totalDuration: number; equipmentCount: number };
  scenarioMetrics: { totalCost: number; totalDuration: number; equipmentCount: number };
  impact: {
    costDelta: number;
    costDeltaPercent: number;
    durationDelta: number;
    equipmentDelta: number;
  };
  riskAnalysis?: {
    p10: number;
    p50: number;
    p90: number;
    probabilityDistribution: Array<{ cost: number; probability: number }>;
  };
  affectedRecords: number;
  timeline: any;
}

export function ScenarioBuilder() {
  const [scenarioType, setScenarioType] = useState('timeline_shift');
  const [shiftDays, setShiftDays] = useState(30);
  const [targetVendor, setTargetVendor] = useState('');
  const [budgetReduction, setBudgetReduction] = useState(15);
  const [organizationIds, setOrganizationIds] = useState<string[]>(['ALL']);
  const [runMonteCarlo, setRunMonteCarlo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScenarioResult | null>(null);

  const runSimulation = async () => {
    setLoading(true);
    try {
      const parameters: any = {};

      if (scenarioType === 'timeline_shift') {
        parameters.shiftDays = shiftDays;
      } else if (scenarioType === 'vendor_switch') {
        parameters.targetVendor = targetVendor;
      } else if (scenarioType === 'budget_cut') {
        parameters.budgetReductionPercent = budgetReduction;
      } else if (scenarioType === 'weather_delay') {
        parameters.weatherDelayRange = { min: 10, max: 30 }; // Randomized
      }

      const simulationResult = await apiClient.runScenarioSimulation({
        scenarioType,
        organizationIds,
        parameters,
        runMonteCarlo,
        iterations: runMonteCarlo ? 1000 : undefined,
      });

      setResult(simulationResult);
    } catch (error) {
      console.error('Simulation failed:', error);
      alert('Failed to run scenario simulation');
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    if (!result) return;
    const blob = await apiClient.exportScenarioPDF(result.scenarioId);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Scenario_${result.scenarioType}.pdf`;
    a.click();
  };

  return (
    <div className="scenario-builder max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🔮 Multiverse Scenario Simulator</h1>
        <p className="text-gray-600">Model what-if scenarios and visualize portfolio impacts</p>
      </div>

      {/* Scenario Configuration */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Configure Scenario</h2>

        {/* Step 1: Scenario Type */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Step 1: Scenario Type</label>
          <select
            value={scenarioType}
            onChange={(e) => setScenarioType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          >
            <option value="timeline_shift">Timeline Shift (Delay/Advance)</option>
            <option value="vendor_switch">Vendor Switch</option>
            <option value="consolidation">Equipment Consolidation</option>
            <option value="budget_cut">Budget Cut</option>
            <option value="weather_delay">Weather Delay (Monte Carlo)</option>
          </select>
        </div>

        {/* Step 2: Parameters */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Step 2: Parameters</label>

          {scenarioType === 'timeline_shift' && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Shift Days (positive = delay, negative = advance)</label>
              <input
                type="number"
                value={shiftDays}
                onChange={(e) => setShiftDays(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {scenarioType === 'vendor_switch' && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Target Vendor (switch all cranes to this vendor)</label>
              <input
                type="text"
                value={targetVendor}
                onChange={(e) => setTargetVendor(e.target.value)}
                placeholder="e.g., Vendor B"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {scenarioType === 'budget_cut' && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Budget Reduction (%)</label>
              <input
                type="number"
                value={budgetReduction}
                onChange={(e) => setBudgetReduction(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {scenarioType === 'weather_delay' && (
            <div className="bg-blue-50 p-3 rounded">
              <p className="text-sm text-blue-800">
                Monte Carlo simulation will randomize weather delays between 10-30 days (1,000 iterations)
              </p>
            </div>
          )}
        </div>

        {/* Step 3: Organizations */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Step 3: Apply to Organizations</label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={organizationIds.includes('ALL')}
                onChange={() => setOrganizationIds(['ALL'])}
              />
              <span className="text-sm">All Organizations</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={!organizationIds.includes('ALL')}
                onChange={() => setOrganizationIds(['HOLNG'])}
              />
              <span className="text-sm">Specific Organizations</span>
            </label>
          </div>
        </div>

        {/* Monte Carlo Toggle */}
        <div className="mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={runMonteCarlo}
              onChange={(e) => setRunMonteCarlo(e.target.checked)}
            />
            <span className="text-sm font-medium text-gray-700">
              Run Monte Carlo Simulation (1,000 iterations for risk analysis)
            </span>
          </label>
        </div>

        {/* Run Button */}
        <button
          onClick={runSimulation}
          disabled={loading}
          className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Running Simulation...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Run Simulation
            </>
          )}
        </button>
      </div>

      {/* Results Dashboard */}
      {result && (
        <div className="space-y-6">
          {/* Impact Summary */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Impact Summary</h2>
              <button
                onClick={exportPDF}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              {/* Cost Impact */}
              <div className={`p-4 rounded-lg ${result.impact.costDelta < 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-sm text-gray-600 mb-1">Cost Impact</p>
                <p
                  className={`text-2xl font-bold ${
                    result.impact.costDelta < 0 ? 'text-green-600' : 'text-red-600'
                  } flex items-center gap-2`}
                >
                  {result.impact.costDelta < 0 ? (
                    <TrendingDown className="w-6 h-6" />
                  ) : (
                    <TrendingUp className="w-6 h-6" />
                  )}
                  {result.impact.costDelta > 0 ? '+' : ''}${result.impact.costDelta.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">
                  {result.impact.costDeltaPercent > 0 ? '+' : ''}
                  {result.impact.costDeltaPercent.toFixed(1)}%
                </p>
              </div>

              {/* Duration Impact */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Timeline Impact</p>
                <p className="text-2xl font-bold text-blue-600">
                  {result.impact.durationDelta > 0 ? '+' : ''}
                  {result.impact.durationDelta} days
                </p>
                <p className="text-sm text-gray-600">
                  {result.scenarioMetrics.totalDuration} days total
                </p>
              </div>

              {/* Equipment Impact */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Equipment Impact</p>
                <p className="text-2xl font-bold text-gray-900">
                  {result.impact.equipmentDelta > 0 ? '+' : ''}
                  {result.impact.equipmentDelta}
                </p>
                <p className="text-sm text-gray-600">
                  {result.affectedRecords} records affected
                </p>
              </div>
            </div>

            {/* Baseline vs. Scenario */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Metric</th>
                  <th className="text-right py-2">Baseline</th>
                  <th className="text-right py-2">Scenario</th>
                  <th className="text-right py-2">Delta</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2">Total Cost</td>
                  <td className="text-right">${result.baselineMetrics.totalCost.toLocaleString()}</td>
                  <td className="text-right">${result.scenarioMetrics.totalCost.toLocaleString()}</td>
                  <td
                    className={`text-right font-semibold ${
                      result.impact.costDelta < 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {result.impact.costDelta > 0 ? '+' : ''}${result.impact.costDelta.toLocaleString()}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Duration (Days)</td>
                  <td className="text-right">{result.baselineMetrics.totalDuration}</td>
                  <td className="text-right">{result.scenarioMetrics.totalDuration}</td>
                  <td className="text-right font-semibold">
                    {result.impact.durationDelta > 0 ? '+' : ''}
                    {result.impact.durationDelta}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Monte Carlo Risk Analysis */}
          {result.riskAnalysis && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Risk Analysis (Monte Carlo Simulation)</h2>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Best Case (P10)</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${result.riskAnalysis.p10.toLocaleString()}
                  </p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Median (P50)</p>
                  <p className="text-2xl font-bold text-blue-600">
                    ${result.riskAnalysis.p50.toLocaleString()}
                  </p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Worst Case (P90)</p>
                  <p className="text-2xl font-bold text-red-600">
                    ${result.riskAnalysis.p90.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Probability Distribution Chart */}
              <div className="h-64 bg-gray-50 rounded flex items-center justify-center">
                <p className="text-gray-500">[Probability Distribution Chart - TODO: Use Chart.js]</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 🧪 Testing Requirements

```typescript
describe('Use Case 25: Multiverse Scenario Simulator', () => {
  // Test 1: Timeline shift scenario
  it('should simulate timeline shift scenario', async () => {
    const result = await scenarioSimulatorService.simulateScenario({
      userId: 'beo-user-id',
      scenarioType: 'timeline_shift',
      organizationIds: ['ALL'],
      parameters: { shiftDays: 30 },
    });

    expect(result.impact.durationDelta).toBe(30);
    expect(result.impact.costDelta).toBeGreaterThan(0); // Longer rentals = higher cost
  });

  // Test 2: Vendor switch scenario
  it('should simulate vendor switch scenario', async () => {
    const result = await scenarioSimulatorService.simulateScenario({
      userId: 'beo-user-id',
      scenarioType: 'vendor_switch',
      organizationIds: ['HOLNG'],
      parameters: { targetVendor: 'Vendor B' },
    });

    expect(result.impact.costDelta).toBeLessThan(0); // Cheaper vendor = cost savings
  });

  // Test 3: Monte Carlo simulation
  it('should run Monte Carlo simulation with 1000 iterations', async () => {
    const result = await scenarioSimulatorService.simulateScenario({
      userId: 'beo-user-id',
      scenarioType: 'weather_delay',
      organizationIds: ['ALL'],
      parameters: { weatherDelayRange: { min: 10, max: 30 } },
      runMonteCarlo: true,
      iterations: 1000,
    });

    expect(result.riskAnalysis).toBeTruthy();
    expect(result.riskAnalysis!.p50).toBeGreaterThan(result.riskAnalysis!.p10);
    expect(result.riskAnalysis!.p90).toBeGreaterThan(result.riskAnalysis!.p50);
  });

  // Test 4: Scenario comparison
  it('should compare multiple scenarios side-by-side', async () => {
    // Run 2 scenarios
    const scenario1 = await scenarioSimulatorService.simulateScenario({
      userId: 'beo-user-id',
      scenarioType: 'timeline_shift',
      organizationIds: ['ALL'],
      parameters: { shiftDays: 30 },
    });

    const scenario2 = await scenarioSimulatorService.simulateScenario({
      userId: 'beo-user-id',
      scenarioType: 'vendor_switch',
      organizationIds: ['ALL'],
      parameters: { targetVendor: 'Vendor B' },
    });

    // Save scenarios
    await scenarioSimulatorService.saveScenario(scenario1);
    await scenarioSimulatorService.saveScenario(scenario2);

    // Compare
    const comparison = await scenarioSimulatorService.compareScenarios([
      scenario1.scenarioId,
      scenario2.scenarioId,
    ]);

    expect(comparison.scenarios.length).toBe(2);
    expect(comparison.recommendation).toBeTruthy();
  });
});
```

---

## 🚀 Implementation Checklist

### Backend Tasks
- [ ] Create `ScenarioSimulatorService.ts`
- [ ] Implement `simulateScenario()` method
- [ ] Implement `applyScenarioTransformations()` logic
- [ ] Implement `runMonteCarloSimulation()` (1000 iterations)
- [ ] Implement `generateTimelineComparison()` Gantt data
- [ ] Implement `saveScenario()` persistence
- [ ] Implement `compareScenarios()` side-by-side
- [ ] Create `ScenarioSimulation` model
- [ ] Create API endpoints
- [ ] Implement PDF export (use Chart.js for charts)

### Frontend Tasks
- [ ] Create `ScenarioBuilder.tsx` component
- [ ] Implement scenario type selection
- [ ] Implement parameter configuration UI
- [ ] Implement impact dashboard
- [ ] Add Monte Carlo risk analysis visualization
- [ ] Add scenario comparison table
- [ ] Implement PDF export button

### Testing Tasks
- [ ] Test timeline shift simulation
- [ ] Test vendor switch simulation
- [ ] Test Monte Carlo simulation (1000 iterations)
- [ ] Test scenario comparison
- [ ] Test PDF export

---

## 🎯 Acceptance Criteria

✅ **Users can configure and run 5 scenario types**
✅ **Simulation calculates accurate cost/duration impacts**
✅ **Monte Carlo simulation runs 1,000 iterations in <30 seconds**
✅ **Risk analysis displays P10/P50/P90 outcomes**
✅ **Scenarios can be saved and compared side-by-side**
✅ **PDF export includes charts and executive summary**
✅ **Only BEO users can access scenario simulator**

---

**End of Prompt Bundle: Task 8.5 - Multiverse Scenario Simulator**

**Status**: Ready for Execution by `ai-systems-architect`
**Estimated Completion**: 1 day

---

## 🎉 Phase 8 Complete

**All 5 BEO Intelligence features are now specified:**
1. ✅ Boardroom Voice Analyst (UC 21)
2. ✅ Narrative Variance Generator (UC 22)
3. ✅ Asset Arbitrage Detector (UC 23)
4. ✅ Vendor Pricing Watchdog (UC 24)
5. ✅ Multiverse Scenario Simulator (UC 25)

**Total Estimated Duration**: 3 days
**Next Phase**: Phase 9 - AI Integration & Refinement

---

---

## 🔧 Phase 9: AI Integration & Refinement

**Duration**: 2 days | **Prerequisites**: Phases 7, 8 Complete

---

# ADR-005 Phase 9: AI Integration & Refinement - Complete Prompt Bundles

**Generated**: 2025-11-27
**Phase**: 9 (AI Integration & Refinement)
**Duration**: 2 days
**Prerequisites**: ✅ Phase 7, 8 Complete (All AI features implemented)

---

## 📋 Phase 9 Overview

**Purpose**: Ensure all 25 AI use cases are production-ready with optimal performance, security, reliability, and cost-efficiency.

**Tasks**:
1. **Task 9.1**: AI Model Performance Tuning (ai-quality-engineer)
2. **Task 9.2**: AI Prompt Engineering (ai-quality-engineer)
3. **Task 9.3**: AI Caching Strategy (backend-architecture-optimizer)
4. **Task 9.4**: AI Error Handling & Fallbacks (backend-architecture-optimizer)

**Critical Requirements**:
- Performance: <500ms p95 latency for AI responses
- Accuracy: >85% confidence threshold for all use cases
- Reliability: 99.9% uptime with graceful degradation
- Cost: 50%+ reduction via caching and model optimization
- Security: Zero AI-related vulnerabilities

---

# 🎯 Task 9.1: AI Model Performance Tuning

**Agent**: `ai-quality-engineer`
**Duration**: 8 hours
**Priority**: P0 (CRITICAL - Blocks Phase 10)

## Context

You are the AI Quality Engineer responsible for optimizing AI model performance across all 25 AI use cases in the Multi-Tenant Access Control system. Your goal is to ensure sub-500ms latency, >85% accuracy, and cost-effective AI operations.

## Objectives

1. ✅ Benchmark AI response times for all 25 use cases
2. ✅ Optimize latency to <500ms p95 across the board
3. ✅ Measure accuracy metrics (precision, recall, F1 for classifications)
4. ✅ Implement A/B testing framework for model comparison
5. ✅ Reduce API costs by 50%+ via caching and model selection

## Source Documents

**Primary References**:
- `docs/ADRs/ADR-005-multi-tenant-access-control/ADR-005-AI_OPPORTUNITIES.md` (25 AI use cases)
- `docs/ADRs/ADR-005-multi-tenant-access-control/ADR-005-TEST_PLAN.md` (AI quality tests)
- `docs/ADRs/ADR-005-multi-tenant-access-control/ADR-005-IMPLEMENTATION_PLAN.md` (Phase 9 specs)

**AI Use Cases to Benchmark** (All 25):
1. UC-16: Context-Aware Access Explanation
2. UC-17: Financial Masking with Relative Indicators
3. UC-18: Semantic Audit Search
4. UC-19: Role Drift Detection
5. UC-20: Behavioral Quiet Mode
6. UC-21: Boardroom Voice Analyst (BEO Analytics)
7. UC-22: Narrative Variance Explainer
8. UC-23: Asset Arbitrage Opportunity Finder
9. UC-24: Vendor Pricing Watchdog
10. UC-25: Multiverse Scenario Simulator
11-25: Additional UX Intelligence features

## Deliverables

### 1. Performance Benchmark Report

**File**: `backend/tests/ai/performance-benchmarks.test.ts`

```typescript
import { describe, it, expect, beforeAll } from '@jest/globals';
import { AiService } from '../../src/services/ai/AiService';
import { performance } from 'perf_hooks';

describe('AI Performance Benchmarks', () => {
  let aiService: AiService;

  beforeAll(() => {
    aiService = new AiService();
  });

  /**
   * UC-16: Context-Aware Access Explanation
   * Target: <200ms p95 latency
   */
  describe('UC-16: Permission Explanation', () => {
    it('should explain permission denial in <200ms', async () => {
      const iterations = 100;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        await aiService.explainPermissionDenial({
          userId: 'user-123',
          organizationId: 'org-456',
          action: 'pems:sync',
          deniedReason: 'Insufficient permissions'
        });

        const duration = performance.now() - start;
        latencies.push(duration);
      }

      const p95 = calculatePercentile(latencies, 95);
      const p99 = calculatePercentile(latencies, 99);
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

      console.log(`UC-16 Latency: Avg=${avg.toFixed(2)}ms, P95=${p95.toFixed(2)}ms, P99=${p99.toFixed(2)}ms`);

      expect(p95).toBeLessThan(200); // <200ms p95
      expect(avg).toBeLessThan(150); // <150ms avg
    });

    it('should achieve >90% accuracy on permission chain detection', async () => {
      const testCases = [
        {
          input: { userId: 'viewer-user', action: 'pfa:delete' },
          expectedChain: ['User has canDelete capability', 'Organization status is active']
        },
        {
          input: { userId: 'editor-user', action: 'pems:sync' },
          expectedChain: ['User has canSync capability', 'Organization enableSync is true']
        },
        // ... 20 more test cases
      ];

      let correct = 0;
      for (const tc of testCases) {
        const explanation = await aiService.explainPermissionDenial(tc.input);
        const detectedAll = tc.expectedChain.every(check =>
          explanation.permissionChain.some(c => c.check.includes(check))
        );
        if (detectedAll) correct++;
      }

      const accuracy = correct / testCases.length;
      console.log(`UC-16 Accuracy: ${(accuracy * 100).toFixed(2)}%`);

      expect(accuracy).toBeGreaterThan(0.90); // >90% accuracy
    });
  });

  /**
   * UC-17: Financial Masking
   * Target: <100ms p95 latency
   */
  describe('UC-17: Financial Masking', () => {
    it('should mask financial data in <100ms', async () => {
      const iterations = 100;
      const latencies: number[] = [];

      const records = Array(50).fill(null).map((_, i) => ({
        id: `pfa-${i}`,
        cost: Math.random() * 500000,
        category: 'Cranes'
      }));

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        await aiService.translateFinancialData({
          userId: 'viewer-user',
          organizationId: 'org-456',
          records,
          userCapabilities: { viewFinancialDetails: false }
        });

        latencies.push(performance.now() - start);
      }

      const p95 = calculatePercentile(latencies, 95);
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

      console.log(`UC-17 Latency: Avg=${avg.toFixed(2)}ms, P95=${p95.toFixed(2)}ms`);

      expect(p95).toBeLessThan(100); // <100ms p95
    });

    it('should correctly classify impact levels (HIGH/MEDIUM/LOW)', async () => {
      const testCases = [
        { cost: 450000, category: 'Cranes', expectedImpact: 'HIGH' },
        { cost: 50000, category: 'Generators', expectedImpact: 'MEDIUM' },
        { cost: 5000, category: 'Tools', expectedImpact: 'LOW' }
      ];

      let correct = 0;
      for (const tc of testCases) {
        const masked = await aiService.translateFinancialData({
          userId: 'user-123',
          organizationId: 'org-456',
          records: [tc],
          userCapabilities: { viewFinancialDetails: false }
        });

        if (masked.maskedRecords[0].impactLevel === tc.expectedImpact) {
          correct++;
        }
      }

      const accuracy = correct / testCases.length;
      expect(accuracy).toBeGreaterThan(0.85); // >85% classification accuracy
    });
  });

  /**
   * UC-18: Semantic Audit Search
   * Target: <500ms p95 latency
   */
  describe('UC-18: Semantic Audit Search', () => {
    it('should parse natural language query in <500ms', async () => {
      const iterations = 50;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        await aiService.semanticAuditSearch({
          query: 'Who changed crane rental duration in the last week?',
          userId: 'user-123',
          organizationId: 'org-456'
        });

        latencies.push(performance.now() - start);
      }

      const p95 = calculatePercentile(latencies, 95);
      console.log(`UC-18 Latency: P95=${p95.toFixed(2)}ms`);

      expect(p95).toBeLessThan(500);
    });

    it('should achieve >80% query understanding accuracy', async () => {
      const testCases = [
        {
          query: 'Who changed crane duration last week?',
          expected: { resourceType: 'PfaRecord', category: 'Cranes', changedFields: ['forecastEnd'] }
        },
        {
          query: 'Show me permission escalations in November',
          expected: { action: 'permission:grant', timeRange: '2025-11' }
        }
        // ... 20 more test cases
      ];

      let correct = 0;
      for (const tc of testCases) {
        const result = await aiService.semanticAuditSearch({
          query: tc.query,
          userId: 'user-123',
          organizationId: 'org-456'
        });

        const matches = Object.keys(tc.expected).every(key =>
          JSON.stringify(result.parsedQuery.filters[key]).includes(tc.expected[key])
        );
        if (matches) correct++;
      }

      const accuracy = correct / testCases.length;
      expect(accuracy).toBeGreaterThan(0.80);
    });
  });

  /**
   * UC-21: Boardroom Voice Analyst (BEO Analytics)
   * Target: <3000ms p95 latency (executive experience)
   */
  describe('UC-21: BEO Analytics', () => {
    it('should answer portfolio queries in <3 seconds', async () => {
      const iterations = 30;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        await aiService.beoAnalytics({
          query: 'Which projects are over budget?',
          userId: 'cfo-456',
          responseFormat: 'conversational'
        });

        latencies.push(performance.now() - start);
      }

      const p95 = calculatePercentile(latencies, 95);
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

      console.log(`UC-21 Latency: Avg=${avg.toFixed(2)}ms, P95=${p95.toFixed(2)}ms`);

      expect(p95).toBeLessThan(3000); // <3s for executive experience
      expect(avg).toBeLessThan(2000); // <2s avg
    });

    it('should calculate portfolio variance with 100% accuracy', async () => {
      const testCases = [
        { organizationId: 'HOLNG', expectedVariance: '+$450K' },
        { organizationId: 'RIO', expectedVariance: '+$220K' }
      ];

      for (const tc of testCases) {
        const response = await aiService.beoAnalytics({
          query: `What is ${tc.organizationId} portfolio variance?`,
          userId: 'cfo-456',
          responseFormat: 'conversational'
        });

        expect(response.executiveSummary.portfolioVariance).toBe(tc.expectedVariance);
      }
    });
  });

  /**
   * UC-19: Role Drift Detection
   * Target: <1000ms p95 latency
   */
  describe('UC-19: Role Drift Detection', () => {
    it('should detect drift patterns in <1 second', async () => {
      const iterations = 20;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        await aiService.detectRoleDrift({
          organizationId: 'org-456'
        });

        latencies.push(performance.now() - start);
      }

      const p95 = calculatePercentile(latencies, 95);
      console.log(`UC-19 Latency: P95=${p95.toFixed(2)}ms`);

      expect(p95).toBeLessThan(1000);
    });

    it('should detect consistent override patterns with >90% precision', async () => {
      // Create 5 users with identical overrides
      const users = await Promise.all([1, 2, 3, 4, 5].map(i =>
        createUser({
          role: 'Field Engineer',
          capabilities: { canManageUsers: true, canManageSettings: true }
        })
      ));

      const drift = await aiService.detectRoleDrift({ organizationId: 'org-456' });

      expect(drift.driftDetected).toBe(true);
      expect(drift.patterns[0].affectedUsers.length).toBe(5);
      expect(drift.patterns[0].driftType).toBe('CONSISTENT_OVERRIDES');
    });
  });

  /**
   * UC-20: Behavioral Quiet Mode
   * Target: <200ms p95 latency
   */
  describe('UC-20: Behavioral Quiet Mode', () => {
    it('should route notifications in <200ms', async () => {
      const iterations = 100;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        await aiService.routeNotification({
          userId: 'user-123',
          notification: { type: 'permission_granted', urgency: 'routine' },
          timestamp: new Date().toISOString()
        });

        latencies.push(performance.now() - start);
      }

      const p95 = calculatePercentile(latencies, 95);
      console.log(`UC-20 Latency: P95=${p95.toFixed(2)}ms`);

      expect(p95).toBeLessThan(200);
    });
  });
});

/**
 * Helper: Calculate percentile
 */
function calculatePercentile(arr: number[], percentile: number): number {
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}
```

### 2. Model Selection Optimization

**File**: `backend/src/services/ai/ModelSelector.ts`

```typescript
import { AiProvider, AiModel } from '../types/ai';

interface ModelConfig {
  provider: AiProvider;
  model: string;
  costPerToken: number; // USD per 1K tokens
  avgLatency: number; // milliseconds
  accuracy: number; // 0-1
}

/**
 * Intelligent model selection based on use case requirements
 */
export class ModelSelector {
  private readonly models: Record<string, ModelConfig> = {
    // Fast, cheap, lower accuracy (good for simple tasks)
    'gemini-flash': {
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      costPerToken: 0.00005,
      avgLatency: 150,
      accuracy: 0.82
    },

    // Balanced (good for most tasks)
    'gemini-pro': {
      provider: 'gemini',
      model: 'gemini-1.5-pro',
      costPerToken: 0.0002,
      avgLatency: 400,
      accuracy: 0.91
    },

    // High accuracy (good for complex reasoning)
    'openai-4': {
      provider: 'openai',
      model: 'gpt-4-turbo',
      costPerToken: 0.001,
      avgLatency: 800,
      accuracy: 0.95
    },

    // Ultra-fast (good for real-time interactions)
    'claude-haiku': {
      provider: 'claude',
      model: 'claude-3-haiku',
      costPerToken: 0.00008,
      avgLatency: 100,
      accuracy: 0.85
    }
  };

  /**
   * Select optimal model for each use case
   */
  selectModel(useCase: string): ModelConfig {
    const requirements = this.getUseCaseRequirements(useCase);

    // Filter models that meet requirements
    const candidates = Object.values(this.models).filter(model =>
      model.avgLatency <= requirements.maxLatency &&
      model.accuracy >= requirements.minAccuracy
    );

    if (candidates.length === 0) {
      throw new Error(`No model meets requirements for ${useCase}`);
    }

    // Sort by cost (cheapest first) among candidates
    candidates.sort((a, b) => a.costPerToken - b.costPerToken);

    return candidates[0]; // Return cheapest model that meets requirements
  }

  /**
   * Define requirements for each use case
   */
  private getUseCaseRequirements(useCase: string): {
    maxLatency: number;
    minAccuracy: number;
  } {
    const requirements: Record<string, any> = {
      'permission-explanation': { maxLatency: 200, minAccuracy: 0.90 },
      'financial-masking': { maxLatency: 100, minAccuracy: 0.85 },
      'semantic-audit-search': { maxLatency: 500, minAccuracy: 0.80 },
      'role-drift-detection': { maxLatency: 1000, minAccuracy: 0.90 },
      'notification-routing': { maxLatency: 200, minAccuracy: 0.85 },
      'beo-analytics': { maxLatency: 3000, minAccuracy: 0.92 },
      'narrative-variance': { maxLatency: 2000, minAccuracy: 0.90 },
      'asset-arbitrage': { maxLatency: 1500, minAccuracy: 0.88 },
      'vendor-watchdog': { maxLatency: 1000, minAccuracy: 0.85 },
      'scenario-simulator': { maxLatency: 5000, minAccuracy: 0.93 }
    };

    return requirements[useCase] || { maxLatency: 1000, minAccuracy: 0.85 };
  }

  /**
   * Cost comparison report
   */
  async generateCostReport(usageStats: Record<string, number>): Promise<any> {
    const report = {
      totalCost: 0,
      savingsVsBaseline: 0,
      breakdown: [] as any[]
    };

    for (const [useCase, requestCount] of Object.entries(usageStats)) {
      const selectedModel = this.selectModel(useCase);
      const avgTokens = 500; // Estimate
      const cost = (requestCount * avgTokens * selectedModel.costPerToken) / 1000;

      // Compare to baseline (always using GPT-4)
      const baselineCost = (requestCount * avgTokens * this.models['openai-4'].costPerToken) / 1000;
      const savings = baselineCost - cost;

      report.totalCost += cost;
      report.savingsVsBaseline += savings;

      report.breakdown.push({
        useCase,
        model: selectedModel.model,
        requestCount,
        cost: `$${cost.toFixed(2)}`,
        savings: `$${savings.toFixed(2)}`,
        savingsPercent: `${((savings / baselineCost) * 100).toFixed(1)}%`
      });
    }

    report.savingsVsBaseline = `$${report.savingsVsBaseline.toFixed(2)}`;
    report.totalCost = `$${report.totalCost.toFixed(2)}`;

    return report;
  }
}
```

### 3. A/B Testing Framework

**File**: `backend/src/services/ai/AbTestService.ts`

```typescript
import { ModelSelector } from './ModelSelector';

interface AbTestConfig {
  name: string;
  useCase: string;
  modelA: string;
  modelB: string;
  trafficSplit: number; // 0-1 (0.5 = 50/50 split)
  duration: number; // milliseconds
  metrics: string[]; // ['latency', 'accuracy', 'cost']
}

/**
 * A/B testing for AI model comparison
 */
export class AbTestService {
  private tests: Map<string, AbTestConfig> = new Map();
  private results: Map<string, any> = new Map();

  /**
   * Start A/B test
   */
  startTest(config: AbTestConfig): string {
    const testId = `abtest-${Date.now()}`;
    this.tests.set(testId, config);
    this.results.set(testId, {
      modelA: { requests: 0, totalLatency: 0, errors: 0, totalCost: 0 },
      modelB: { requests: 0, totalLatency: 0, errors: 0, totalCost: 0 }
    });

    console.log(`Started A/B test: ${config.name} (${config.modelA} vs ${config.modelB})`);
    return testId;
  }

  /**
   * Route request to A or B based on traffic split
   */
  routeRequest(testId: string): 'A' | 'B' {
    const config = this.tests.get(testId);
    if (!config) throw new Error('Test not found');

    return Math.random() < config.trafficSplit ? 'A' : 'B';
  }

  /**
   * Record metrics for A/B test
   */
  recordMetrics(testId: string, variant: 'A' | 'B', metrics: {
    latency: number;
    cost: number;
    error?: boolean;
  }) {
    const results = this.results.get(testId);
    if (!results) return;

    const variantKey = `model${variant}`;
    results[variantKey].requests++;
    results[variantKey].totalLatency += metrics.latency;
    results[variantKey].totalCost += metrics.cost;
    if (metrics.error) results[variantKey].errors++;
  }

  /**
   * Get A/B test results
   */
  getResults(testId: string): any {
    const config = this.tests.get(testId);
    const results = this.results.get(testId);

    if (!config || !results) return null;

    const reportA = {
      model: config.modelA,
      requests: results.modelA.requests,
      avgLatency: results.modelA.totalLatency / results.modelA.requests,
      errorRate: results.modelA.errors / results.modelA.requests,
      totalCost: results.modelA.totalCost
    };

    const reportB = {
      model: config.modelB,
      requests: results.modelB.requests,
      avgLatency: results.modelB.totalLatency / results.modelB.requests,
      errorRate: results.modelB.errors / results.modelB.requests,
      totalCost: results.modelB.totalCost
    };

    // Determine winner
    let winner = 'TIE';
    if (reportA.avgLatency < reportB.avgLatency && reportA.totalCost < reportB.totalCost) {
      winner = 'A';
    } else if (reportB.avgLatency < reportA.avgLatency && reportB.totalCost < reportA.totalCost) {
      winner = 'B';
    }

    return {
      testName: config.name,
      winner,
      modelA: reportA,
      modelB: reportB,
      recommendation: this.generateRecommendation(reportA, reportB)
    };
  }

  private generateRecommendation(a: any, b: any): string {
    const latencyDiff = ((a.avgLatency - b.avgLatency) / b.avgLatency) * 100;
    const costDiff = ((a.totalCost - b.totalCost) / b.totalCost) * 100;

    if (Math.abs(latencyDiff) < 10 && Math.abs(costDiff) < 10) {
      return 'Performance is comparable. Choose based on other factors.';
    }

    if (latencyDiff < -20 && costDiff < 0) {
      return `${a.model} is significantly faster (${Math.abs(latencyDiff).toFixed(1)}% faster) and cheaper. Strong recommendation.`;
    }

    if (latencyDiff > 20 && costDiff > 0) {
      return `${b.model} is significantly faster (${Math.abs(latencyDiff).toFixed(1)}% faster) and cheaper. Strong recommendation.`;
    }

    return `Trade-off: ${a.model} is ${latencyDiff > 0 ? 'slower' : 'faster'} but ${costDiff > 0 ? 'more expensive' : 'cheaper'}. Choose based on priority.`;
  }
}
```

### 4. Performance Monitoring Dashboard

**File**: `backend/src/services/ai/PerformanceMonitor.ts`

```typescript
import { EventEmitter } from 'events';

interface PerformanceMetrics {
  useCase: string;
  model: string;
  latency: number;
  tokens: number;
  cost: number;
  timestamp: Date;
  success: boolean;
}

/**
 * Real-time AI performance monitoring
 */
export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private readonly maxMetricsStored = 10000;

  /**
   * Record AI operation metrics
   */
  record(metrics: PerformanceMetrics) {
    this.metrics.push(metrics);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsStored) {
      this.metrics = this.metrics.slice(-this.maxMetricsStored);
    }

    // Emit alert if latency exceeds threshold
    const threshold = this.getLatencyThreshold(metrics.useCase);
    if (metrics.latency > threshold) {
      this.emit('latency-alert', {
        useCase: metrics.useCase,
        latency: metrics.latency,
        threshold
      });
    }
  }

  /**
   * Get performance summary
   */
  getSummary(period: 'hour' | 'day' | 'week' = 'hour'): any {
    const cutoff = this.getCutoffTime(period);
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoff);

    const summary = {
      totalRequests: recentMetrics.length,
      successRate: recentMetrics.filter(m => m.success).length / recentMetrics.length,
      avgLatency: this.average(recentMetrics.map(m => m.latency)),
      p95Latency: this.percentile(recentMetrics.map(m => m.latency), 95),
      totalCost: recentMetrics.reduce((sum, m) => sum + m.cost, 0),
      byUseCase: this.groupByUseCase(recentMetrics)
    };

    return summary;
  }

  private groupByUseCase(metrics: PerformanceMetrics[]): Record<string, any> {
    const grouped: Record<string, PerformanceMetrics[]> = {};

    for (const metric of metrics) {
      if (!grouped[metric.useCase]) grouped[metric.useCase] = [];
      grouped[metric.useCase].push(metric);
    }

    const result: Record<string, any> = {};
    for (const [useCase, items] of Object.entries(grouped)) {
      result[useCase] = {
        requests: items.length,
        avgLatency: this.average(items.map(m => m.latency)),
        successRate: items.filter(m => m.success).length / items.length,
        totalCost: items.reduce((sum, m) => sum + m.cost, 0)
      };
    }

    return result;
  }

  private average(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private percentile(arr: number[], p: number): number {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }

  private getCutoffTime(period: string): Date {
    const now = new Date();
    const cutoffs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000
    };
    return new Date(now.getTime() - cutoffs[period]);
  }

  private getLatencyThreshold(useCase: string): number {
    const thresholds: Record<string, number> = {
      'permission-explanation': 200,
      'financial-masking': 100,
      'semantic-audit-search': 500,
      'beo-analytics': 3000
    };
    return thresholds[useCase] || 1000;
  }
}
```

## Acceptance Criteria

- [ ] All 25 AI use cases benchmarked with latency, accuracy, cost metrics
- [ ] P95 latency <500ms for all use cases (or specific targets)
- [ ] Accuracy >85% for classification tasks
- [ ] A/B testing framework operational with at least 3 model comparisons
- [ ] Cost reduction >50% vs baseline (all GPT-4)
- [ ] Performance monitoring dashboard showing real-time metrics
- [ ] Alerts configured for latency/error spikes

## Testing

```bash
# Run performance benchmarks
npm run test:ai-performance

# Generate cost report
npm run ai:cost-report

# Start A/B test
npm run ai:ab-test -- --name "Permission Explanation" --modelA gemini-flash --modelB gemini-pro

# View performance dashboard
npm run ai:monitor
```

## Success Metrics

- ✅ **Latency**: All use cases meet p95 targets
- ✅ **Accuracy**: >85% precision/recall on classification tasks
- ✅ **Cost**: 50%+ reduction vs all-GPT-4 baseline
- ✅ **Reliability**: <1% error rate across all AI operations
- ✅ **Observability**: Real-time metrics dashboard operational

---

# 🎯 Task 9.2: AI Prompt Engineering

**Agent**: `ai-quality-engineer`
**Duration**: 6 hours
**Priority**: P0 (CRITICAL - Blocks Phase 10)

## Context

You are the AI Quality Engineer responsible for optimizing AI prompts across all 25 use cases. Your goal is to maximize accuracy, minimize latency, reduce token usage, and implement prompt versioning with confidence thresholds.

## Objectives

1. ✅ Optimize prompts for all 25 AI use cases
2. ✅ Implement version control for prompts (Git-based)
3. ✅ Tune confidence thresholds (reject <70% confidence)
4. ✅ Add few-shot learning examples for complex tasks
5. ✅ Create prompt testing framework (automated validation)

## Source Documents

**Primary References**:
- `docs/ADRs/ADR-005-multi-tenant-access-control/ADR-005-AI_OPPORTUNITIES.md` (AI use case prompts)
- `docs/ADRs/ADR-005-multi-tenant-access-control/ADR-005-TEST_PLAN.md` (Prompt quality tests)

## Deliverables

### 1. Prompt Library with Version Control

**File**: `backend/src/services/ai/prompts/PromptRegistry.ts`

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

interface PromptTemplate {
  version: string;
  lastUpdated: Date;
  author: string;
  template: string;
  fewShotExamples?: any[];
  confidenceThreshold: number;
  expectedOutputFormat: 'json' | 'text' | 'markdown';
}

/**
 * Centralized prompt registry with version control
 */
export class PromptRegistry {
  private prompts: Map<string, PromptTemplate> = new Map();

  constructor() {
    this.loadPrompts();
  }

  /**
   * Load all prompts from version-controlled files
   */
  private loadPrompts() {
    const promptDir = join(__dirname, './templates');

    // UC-16: Permission Explanation
    this.prompts.set('permission-explanation', {
      version: '2.1.0',
      lastUpdated: new Date('2025-11-27'),
      author: 'ai-quality-engineer',
      template: this.loadTemplate(join(promptDir, 'permission-explanation-v2.1.txt')),
      confidenceThreshold: 0.85,
      expectedOutputFormat: 'json'
    });

    // UC-17: Financial Masking
    this.prompts.set('financial-masking', {
      version: '1.3.0',
      lastUpdated: new Date('2025-11-27'),
      author: 'ai-quality-engineer',
      template: this.loadTemplate(join(promptDir, 'financial-masking-v1.3.txt')),
      confidenceThreshold: 0.80,
      expectedOutputFormat: 'json'
    });

    // UC-18: Semantic Audit Search
    this.prompts.set('semantic-audit-search', {
      version: '3.0.0',
      lastUpdated: new Date('2025-11-27'),
      author: 'ai-quality-engineer',
      template: this.loadTemplate(join(promptDir, 'semantic-audit-search-v3.0.txt')),
      fewShotExamples: this.loadFewShotExamples('semantic-audit-search'),
      confidenceThreshold: 0.75,
      expectedOutputFormat: 'json'
    });

    // UC-21: BEO Analytics
    this.prompts.set('beo-analytics', {
      version: '2.5.0',
      lastUpdated: new Date('2025-11-27'),
      author: 'ai-quality-engineer',
      template: this.loadTemplate(join(promptDir, 'beo-analytics-v2.5.txt')),
      fewShotExamples: this.loadFewShotExamples('beo-analytics'),
      confidenceThreshold: 0.90,
      expectedOutputFormat: 'json'
    });

    // ... Load remaining 21 prompts
  }

  /**
   * Get prompt template
   */
  getPrompt(useCase: string): PromptTemplate {
    const prompt = this.prompts.get(useCase);
    if (!prompt) {
      throw new Error(`Prompt not found for use case: ${useCase}`);
    }
    return prompt;
  }

  /**
   * Render prompt with variables
   */
  render(useCase: string, variables: Record<string, any>): string {
    const prompt = this.getPrompt(useCase);
    let rendered = prompt.template;

    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
    }

    // Add few-shot examples if present
    if (prompt.fewShotExamples && prompt.fewShotExamples.length > 0) {
      const examples = prompt.fewShotExamples
        .map(ex => `Input: ${JSON.stringify(ex.input)}\nOutput: ${JSON.stringify(ex.output)}`)
        .join('\n\n');
      rendered = `${examples}\n\n${rendered}`;
    }

    return rendered;
  }

  private loadTemplate(path: string): string {
    return readFileSync(path, 'utf-8');
  }

  private loadFewShotExamples(useCase: string): any[] {
    const examplesPath = join(__dirname, `./examples/${useCase}.json`);
    try {
      return JSON.parse(readFileSync(examplesPath, 'utf-8'));
    } catch {
      return [];
    }
  }
}
```

### 2. Optimized Prompt Templates

**File**: `backend/src/services/ai/prompts/templates/permission-explanation-v2.1.txt`

```
# Permission Denial Explanation

You are a security assistant helping users understand why their access was denied.

## Context
- User: {{username}} (ID: {{userId}})
- Organization: {{organizationCode}} (ID: {{organizationId}})
- Action Attempted: {{action}}
- Denial Reason: {{deniedReason}}

## User's Current Permissions
{{userPermissions}}

## Organization Status
- Service Status: {{orgServiceStatus}}
- Sync Enabled: {{orgEnableSync}}

## Task
Analyze the permission chain and provide:

1. **Permission Chain**: List each permission check and its result (pass/fail)
2. **Actionable Steps**: Specific steps user can take to resolve (contact admin, check org status, etc.)
3. **Estimated Resolution Time**: How long will it take to fix?
4. **Confidence Score**: How confident are you in this explanation (0-1)?

## Output Format (JSON)
{
  "permissionChain": [
    { "check": "User has canWrite capability", "result": false, "reason": "User role is viewer" },
    { "check": "Organization status is active", "result": true, "reason": "Org status: active" }
  ],
  "actionableSteps": [
    { "action": "Contact admin to request write access", "contact": "admin@example.com", "eta": "1-2 business days" }
  ],
  "estimatedResolutionTime": "1-2 business days",
  "confidence": 0.92
}

## Important Rules
- Only suggest actions the user can actually take
- If multiple permission checks failed, list ALL of them
- Always include a confidence score
- If confidence < 0.70, flag as UNCERTAIN and recommend manual review
```

**File**: `backend/src/services/ai/prompts/templates/financial-masking-v1.3.txt`

```
# Financial Data Masking with Relative Indicators

You are a data privacy assistant masking financial information while providing useful relative context.

## Context
- User ID: {{userId}}
- Organization: {{organizationId}}
- User has viewFinancialDetails: {{viewFinancialDetails}}
- Records: {{recordCount}} equipment records

## Task
For each record, provide:
1. **Impact Level**: HIGH (top 10%), MEDIUM (11-50%), LOW (51-100%)
2. **Relative Comparison**: e.g., "3.2x more expensive than typical cranes"
3. **Percentile**: e.g., "Top 5% of crane costs"
4. **AI Insight**: Brief recommendation (e.g., "Consider alternatives")

## Records
{{records}}

## Output Format (JSON)
{
  "maskedRecords": [
    {
      "id": "pfa-1",
      "cost": "***masked***",
      "impactLevel": "HIGH",
      "relativeComparison": "3.2x more expensive than typical cranes",
      "percentile": "Top 5%",
      "impactDescription": "This equipment is significantly more expensive than similar items",
      "aiInsight": "Consider negotiating rental rate or exploring alternatives"
    }
  ],
  "portfolioInsight": "3 high-impact items (>$100K each), 10 medium-impact, 32 low-impact",
  "confidence": 0.89
}

## Important Rules
- NEVER include absolute costs in output
- Impact levels based on category benchmarks (compare cranes to cranes, not to generators)
- If user has viewFinancialDetails=true, STILL mask but provide more detail
- Confidence < 0.70 = flag as UNCERTAIN
```

**File**: `backend/src/services/ai/prompts/templates/semantic-audit-search-v3.0.txt`

```
# Semantic Audit Search Query Parser

You are a query understanding assistant converting natural language to structured filters.

## User Query
"{{query}}"

## Available Filters
- resourceType: PfaRecord | User | Organization | Permission
- action: create | read | update | delete | permission:grant | permission:revoke | sync
- userId: string
- organizationId: string
- changedFields: array of field names
- timeRange: { start: ISO8601, end: ISO8601 }
- category: string (for PfaRecord)
- booleanOperator: AND | OR

## Task
Parse the query and extract structured filters. Also provide:
1. **Natural Language Summary**: Human-readable summary of what the query is asking
2. **Confidence**: How confident are you in this interpretation (0-1)?
3. **Clarification Needed**: If query is ambiguous, what questions should we ask?

## Output Format (JSON)
{
  "parsedQuery": {
    "filters": {
      "resourceType": "PfaRecord",
      "changedFields": ["forecastEnd", "forecastStart"],
      "category": "Cranes",
      "timeRange": { "start": "2025-11-19T00:00:00Z", "end": "2025-11-26T23:59:59Z" }
    }
  },
  "naturalLanguageSummary": "Show me PFA records where crane rental duration was changed in the last week",
  "confidence": 0.91,
  "clarificationNeeded": null
}

## Important Rules
- If confidence < 0.70, set clarificationNeeded with specific questions
- Use ISO8601 format for dates
- If no time range specified, default to last 30 days
- If multiple interpretations possible, choose most likely and flag in clarificationNeeded
```

**File**: `backend/src/services/ai/prompts/templates/beo-analytics-v2.5.txt`

```
# BEO Portfolio Analytics (Executive Voice Analyst)

You are an executive business analyst providing concise, accurate portfolio insights.

## Executive Context
- User: {{userName}} ({{userRole}})
- Query: "{{query}}"
- Response Format: {{responseFormat}} (conversational | technical)

## Portfolio Data
{{portfolioData}}

## Task
Answer the executive's question with:
1. **Executive Summary**: 1-2 sentence high-level answer
2. **Portfolio Variance**: Actual vs. Plan with $ amounts
3. **Projects At Risk**: Count and details
4. **Narrative**: 2-3 paragraphs explaining "why" (root causes)
5. **Voice Response**: Natural voice-friendly version (no dollar signs, spell out numbers)

## Output Format (JSON)
{
  "narrative": "Three of your seven projects are trending over budget...",
  "executiveSummary": {
    "portfolioVariance": "+$825K",
    "projectsAtRisk": 3,
    "topDriver": "Weather delays and crane rental extensions"
  },
  "detailedBreakdown": [
    {
      "organizationId": "HOLNG",
      "variance": "+$450K (+12%)",
      "primaryDriver": "Extended crane rentals due to weather delays",
      "trend": "worsening"
    }
  ],
  "voiceResponse": "You have three projects currently trending over budget, for a total variance of eight hundred twenty-five thousand dollars...",
  "confidence": 0.94
}

## Important Rules
- Voice response: spell out numbers, no symbols ($, %, etc.)
- Keep narrative concise (2-3 paragraphs MAX for executives)
- Always include $ amounts in executiveSummary
- Confidence < 0.85 = flag as NEEDS_REVIEW
- Adapt tone to user role (CFO = financial focus, COO = operational focus)
```

### 3. Few-Shot Learning Examples

**File**: `backend/src/services/ai/prompts/examples/semantic-audit-search.json`

```json
[
  {
    "input": {
      "query": "Who changed crane rental duration in the last week?"
    },
    "output": {
      "parsedQuery": {
        "filters": {
          "resourceType": "PfaRecord",
          "changedFields": ["forecastEnd", "forecastStart"],
          "category": "Cranes",
          "timeRange": { "start": "2025-11-19T00:00:00Z", "end": "2025-11-26T23:59:59Z" }
        }
      },
      "naturalLanguageSummary": "Show me who modified crane rental duration in the last 7 days",
      "confidence": 0.92
    }
  },
  {
    "input": {
      "query": "Show me permission escalations in November"
    },
    "output": {
      "parsedQuery": {
        "filters": {
          "action": "permission:grant",
          "timeRange": { "start": "2025-11-01T00:00:00Z", "end": "2025-11-30T23:59:59Z" }
        }
      },
      "naturalLanguageSummary": "Show me all permission grants in November 2025",
      "confidence": 0.89
    }
  },
  {
    "input": {
      "query": "Bulk changes to PFA records AND permission escalations last month"
    },
    "output": {
      "parsedQuery": {
        "filters": {
          "action": ["pfa:bulk_update", "permission:grant"],
          "booleanOperator": "AND",
          "timeRange": { "start": "2025-10-01T00:00:00Z", "end": "2025-10-31T23:59:59Z" }
        }
      },
      "naturalLanguageSummary": "Show me bulk PFA updates and permission grants in October 2025",
      "confidence": 0.85
    }
  }
]
```

**File**: `backend/src/services/ai/prompts/examples/beo-analytics.json`

```json
[
  {
    "input": {
      "query": "Which projects are over budget?",
      "userRole": "CFO"
    },
    "output": {
      "narrative": "Three of your seven projects are currently trending over budget, for a total variance of $825K (4.2% over plan). HOLNG leads with $450K variance due to extended crane rentals from weather delays. RIO is $220K over from unplanned generator additions. PEMS shows $155K variance from procurement timing issues.",
      "executiveSummary": {
        "portfolioVariance": "+$825K",
        "projectsAtRisk": 3
      },
      "confidence": 0.94
    }
  }
]
```

### 4. Confidence Threshold Validation

**File**: `backend/src/services/ai/ConfidenceValidator.ts`

```typescript
interface AiResponse {
  confidence: number;
  [key: string]: any;
}

/**
 * Validate AI responses against confidence thresholds
 */
export class ConfidenceValidator {
  private thresholds: Record<string, number> = {
    'permission-explanation': 0.85,
    'financial-masking': 0.80,
    'semantic-audit-search': 0.75,
    'role-drift-detection': 0.85,
    'beo-analytics': 0.90,
    'narrative-variance': 0.88,
    'asset-arbitrage': 0.80,
    'vendor-watchdog': 0.75,
    'scenario-simulator': 0.85
  };

  /**
   * Validate response confidence
   */
  validate(useCase: string, response: AiResponse): {
    passed: boolean;
    reason?: string;
    recommendation?: string;
  } {
    const threshold = this.thresholds[useCase] || 0.70;

    if (response.confidence < threshold) {
      return {
        passed: false,
        reason: `Confidence ${response.confidence.toFixed(2)} below threshold ${threshold.toFixed(2)}`,
        recommendation: this.getRecommendation(useCase, response.confidence)
      };
    }

    return { passed: true };
  }

  private getRecommendation(useCase: string, confidence: number): string {
    if (confidence < 0.50) {
      return 'REJECT: Confidence too low. Use rule-based fallback or manual review.';
    } else if (confidence < 0.70) {
      return 'CAUTION: Show warning to user and offer manual review option.';
    } else {
      return 'BORDERLINE: Proceed but log for quality review.';
    }
  }

  /**
   * Update threshold for a use case
   */
  updateThreshold(useCase: string, newThreshold: number) {
    if (newThreshold < 0 || newThreshold > 1) {
      throw new Error('Threshold must be between 0 and 1');
    }
    this.thresholds[useCase] = newThreshold;
    console.log(`Updated threshold for ${useCase}: ${newThreshold}`);
  }
}
```

### 5. Prompt Testing Framework

**File**: `backend/tests/ai/prompt-quality.test.ts`

```typescript
import { PromptRegistry } from '../../src/services/ai/prompts/PromptRegistry';
import { ConfidenceValidator } from '../../src/services/ai/ConfidenceValidator';

describe('Prompt Quality Tests', () => {
  let promptRegistry: PromptRegistry;
  let validator: ConfidenceValidator;

  beforeAll(() => {
    promptRegistry = new PromptRegistry();
    validator = new ConfidenceValidator();
  });

  describe('Permission Explanation Prompts', () => {
    it('should render prompt with all required variables', () => {
      const prompt = promptRegistry.render('permission-explanation', {
        username: 'john.doe',
        userId: 'user-123',
        organizationCode: 'HOLNG',
        organizationId: 'org-456',
        action: 'pems:sync',
        deniedReason: 'User does not have canSync capability',
        userPermissions: JSON.stringify({ canRead: true, canWrite: false, canSync: false }),
        orgServiceStatus: 'active',
        orgEnableSync: true
      });

      expect(prompt).toContain('john.doe');
      expect(prompt).toContain('HOLNG');
      expect(prompt).toContain('pems:sync');
      expect(prompt).not.toContain('{{'); // No unrendered variables
    });

    it('should enforce confidence threshold', async () => {
      const response = {
        permissionChain: [],
        actionableSteps: [],
        confidence: 0.65
      };

      const validation = validator.validate('permission-explanation', response);
      expect(validation.passed).toBe(false);
      expect(validation.recommendation).toContain('CAUTION');
    });
  });

  describe('Semantic Audit Search Prompts', () => {
    it('should include few-shot examples', () => {
      const prompt = promptRegistry.render('semantic-audit-search', {
        query: 'Who changed crane duration last week?'
      });

      expect(prompt).toContain('Input:');
      expect(prompt).toContain('Output:');
    });

    it('should handle low confidence gracefully', async () => {
      const response = {
        parsedQuery: { filters: {} },
        confidence: 0.45
      };

      const validation = validator.validate('semantic-audit-search', response);
      expect(validation.passed).toBe(false);
      expect(validation.recommendation).toContain('REJECT');
    });
  });

  describe('BEO Analytics Prompts', () => {
    it('should generate executive-friendly voice response', () => {
      const response = {
        voiceResponse: 'You have three projects currently trending over budget, for a total variance of eight hundred twenty-five thousand dollars.',
        confidence: 0.94
      };

      expect(response.voiceResponse).not.toContain('$');
      expect(response.voiceResponse).not.toContain('825K');
      expect(response.voiceResponse).toContain('eight hundred');
    });

    it('should enforce high confidence threshold for executives', async () => {
      const response = {
        narrative: 'Some projects are over budget',
        confidence: 0.82
      };

      const validation = validator.validate('beo-analytics', response);
      expect(validation.passed).toBe(false); // Threshold is 0.90
    });
  });
});
```

## Acceptance Criteria

- [ ] All 25 prompt templates created and version-controlled
- [ ] Few-shot examples added for complex use cases (semantic search, BEO analytics)
- [ ] Confidence thresholds configured for all use cases
- [ ] Prompt testing framework with >80% coverage
- [ ] Version registry tracks all prompt changes
- [ ] Validation ensures no responses below confidence threshold reach users

## Testing

```bash
# Test prompt rendering
npm run test:prompts

# Validate all prompts
npm run prompts:validate

# Generate prompt changelog
npm run prompts:changelog

# Update prompt version
npm run prompts:update -- --use-case permission-explanation --version 2.2.0
```

## Success Metrics

- ✅ **Coverage**: 25/25 use cases have optimized prompts
- ✅ **Quality**: >90% of responses meet confidence thresholds
- ✅ **Version Control**: All prompts tracked in Git with changelog
- ✅ **Few-Shot Learning**: Complex use cases have 3-5 examples
- ✅ **Validation**: 0 responses below threshold reach users

---

# 🎯 Task 9.3: AI Caching Strategy

**Agent**: `backend-architecture-optimizer`
**Duration**: 6 hours
**Priority**: P0 (CRITICAL - Cost Reduction)

## Context

You are the Backend Architecture Optimizer responsible for implementing Redis caching for AI responses to reduce latency and API costs by 50%+. Your goal is to cache AI responses intelligently while ensuring data freshness.

## Objectives

1. ✅ Implement Redis caching for AI responses
2. ✅ Configure LRU cache with TTL (15 min for permission suggestions, 5 min for audit queries)
3. ✅ Implement cache invalidation strategies
4. ✅ Monitor cache hit rate (target: >80%)
5. ✅ Calculate cost savings

## Source Documents

**Primary References**:
- `docs/ADRs/ADR-005-multi-tenant-access-control/ADR-005-IMPLEMENTATION_PLAN.md` (Phase 9.3 specs)

## Deliverables

### 1. Redis Cache Service

**File**: `backend/src/services/ai/AiCacheService.ts`

```typescript
import Redis from 'ioredis';
import { createHash } from 'crypto';

interface CacheConfig {
  ttl: number; // seconds
  maxSize?: number; // max items before LRU eviction
  invalidateOn?: string[]; // Events that invalidate cache
}

/**
 * Redis caching for AI responses
 */
export class AiCacheService {
  private redis: Redis;
  private config: Record<string, CacheConfig> = {
    // Permission explanation: Cache for 15 minutes
    'permission-explanation': {
      ttl: 15 * 60,
      invalidateOn: ['permission:change', 'user:update', 'org:update']
    },

    // Financial masking: Cache for 5 minutes (data changes frequently)
    'financial-masking': {
      ttl: 5 * 60,
      invalidateOn: ['pfa:update', 'pfa:bulk_update']
    },

    // Semantic audit search: Cache for 5 minutes
    'semantic-audit-search': {
      ttl: 5 * 60,
      invalidateOn: ['audit:new_entry']
    },

    // Role drift detection: Cache for 1 hour (expensive to compute)
    'role-drift-detection': {
      ttl: 60 * 60,
      invalidateOn: ['permission:change', 'user:create', 'role:update']
    },

    // Notification routing: Cache for 24 hours (user preferences change rarely)
    'notification-routing': {
      ttl: 24 * 60 * 60,
      invalidateOn: ['user:preferences:update']
    },

    // BEO analytics: Cache for 10 minutes
    'beo-analytics': {
      ttl: 10 * 60,
      invalidateOn: ['pfa:update', 'pfa:bulk_update']
    },

    // Narrative variance: Cache for 15 minutes
    'narrative-variance': {
      ttl: 15 * 60,
      invalidateOn: ['pfa:update']
    },

    // Asset arbitrage: Cache for 30 minutes
    'asset-arbitrage': {
      ttl: 30 * 60,
      invalidateOn: ['pfa:update', 'asset:price_update']
    },

    // Vendor watchdog: Cache for 1 hour
    'vendor-watchdog': {
      ttl: 60 * 60,
      invalidateOn: ['vendor:price_update']
    },

    // Scenario simulator: Cache for 5 minutes (session-based)
    'scenario-simulator': {
      ttl: 5 * 60,
      invalidateOn: ['scenario:reset']
    }
  };

  private stats = {
    hits: 0,
    misses: 0,
    invalidations: 0
  };

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });

    // Set LRU eviction policy
    this.redis.config('SET', 'maxmemory-policy', 'allkeys-lru');
  }

  /**
   * Get cached AI response
   */
  async get(useCase: string, params: Record<string, any>): Promise<any | null> {
    const key = this.generateCacheKey(useCase, params);

    try {
      const cached = await this.redis.get(key);
      if (cached) {
        this.stats.hits++;
        return JSON.parse(cached);
      } else {
        this.stats.misses++;
        return null;
      }
    } catch (error) {
      console.error('Cache GET error:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Cache AI response
   */
  async set(useCase: string, params: Record<string, any>, response: any): Promise<void> {
    const key = this.generateCacheKey(useCase, params);
    const config = this.config[useCase];

    if (!config) {
      console.warn(`No cache config for use case: ${useCase}`);
      return;
    }

    try {
      await this.redis.setex(key, config.ttl, JSON.stringify(response));
    } catch (error) {
      console.error('Cache SET error:', error);
    }
  }

  /**
   * Invalidate cache on specific events
   */
  async invalidate(event: string, context?: Record<string, any>): Promise<number> {
    let invalidated = 0;

    for (const [useCase, config] of Object.entries(this.config)) {
      if (config.invalidateOn?.includes(event)) {
        const pattern = `ai:${useCase}:*`;

        // Get all matching keys
        const keys = await this.redis.keys(pattern);

        // Optionally filter by context (e.g., only invalidate for specific user)
        const keysToDelete = context
          ? keys.filter(key => this.matchesContext(key, context))
          : keys;

        if (keysToDelete.length > 0) {
          await this.redis.del(...keysToDelete);
          invalidated += keysToDelete.length;
        }
      }
    }

    this.stats.invalidations += invalidated;
    console.log(`Invalidated ${invalidated} cache entries for event: ${event}`);
    return invalidated;
  }

  /**
   * Generate deterministic cache key
   */
  private generateCacheKey(useCase: string, params: Record<string, any>): string {
    // Sort params for deterministic key
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, any>);

    const hash = createHash('sha256')
      .update(JSON.stringify(sortedParams))
      .digest('hex')
      .substring(0, 16);

    return `ai:${useCase}:${hash}`;
  }

  /**
   * Check if cache key matches invalidation context
   */
  private matchesContext(key: string, context: Record<string, any>): boolean {
    // Extract params from key and check if they match context
    // For now, invalidate all keys (can be optimized later)
    return true;
  }

  /**
   * Get cache statistics
   */
  getStats(): any {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: `${(hitRate * 100).toFixed(2)}%`,
      invalidations: this.stats.invalidations,
      total
    };
  }

  /**
   * Clear all AI cache
   */
  async clearAll(): Promise<number> {
    const keys = await this.redis.keys('ai:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    return keys.length;
  }
}
```

### 2. Cache Invalidation Middleware

**File**: `backend/src/middleware/cacheInvalidation.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { AiCacheService } from '../services/ai/AiCacheService';

const cacheService = new AiCacheService();

/**
 * Middleware to invalidate AI cache on data mutations
 */
export function invalidateAiCache(event: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original res.json
    const originalJson = res.json.bind(res);

    // Override res.json to invalidate cache after successful mutation
    res.json = function(body: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Success response - invalidate cache asynchronously
        cacheService.invalidate(event, {
          userId: req.user?.id,
          organizationId: req.body?.organizationId || req.params?.organizationId
        }).catch(error => {
          console.error('Cache invalidation error:', error);
        });
      }

      return originalJson(body);
    };

    next();
  };
}

/**
 * Apply cache invalidation to routes
 */
export function setupCacheInvalidation(app: any) {
  // Permission changes invalidate permission-explanation cache
  app.use('/api/permissions/*', invalidateAiCache('permission:change'));

  // User updates invalidate permission-explanation cache
  app.use('/api/users/:id', invalidateAiCache('user:update'));

  // PFA updates invalidate financial-masking and BEO analytics
  app.use('/api/pfa/*', invalidateAiCache('pfa:update'));

  // Bulk PFA updates
  app.use('/api/pfa/bulk', invalidateAiCache('pfa:bulk_update'));

  // Audit log entries invalidate semantic-audit-search
  app.use('/api/audit-logs', invalidateAiCache('audit:new_entry'));

  console.log('AI cache invalidation middleware configured');
}
```

### 3. Cache Hit Rate Monitoring

**File**: `backend/src/services/ai/CacheMonitor.ts`

```typescript
import { AiCacheService } from './AiCacheService';

/**
 * Monitor cache performance and cost savings
 */
export class CacheMonitor {
  private cacheService: AiCacheService;

  constructor(cacheService: AiCacheService) {
    this.cacheService = cacheService;
  }

  /**
   * Calculate cost savings from caching
   */
  async calculateSavings(period: 'hour' | 'day' | 'week' = 'day'): Promise<any> {
    const stats = this.cacheService.getStats();

    // Assume average AI call costs $0.002 (2K tokens @ $0.001/1K tokens)
    const avgAiCallCost = 0.002;

    // Cache hits saved these AI calls
    const savedCalls = stats.hits;
    const totalSavings = savedCalls * avgAiCallCost;

    // Actual costs (cache misses that resulted in AI calls)
    const actualCosts = stats.misses * avgAiCallCost;

    // Total cost without caching
    const costWithoutCache = (stats.hits + stats.misses) * avgAiCallCost;

    return {
      period,
      stats,
      costs: {
        savedCalls,
        totalSavings: `$${totalSavings.toFixed(2)}`,
        actualCosts: `$${actualCosts.toFixed(2)}`,
        costWithoutCache: `$${costWithoutCache.toFixed(2)}`,
        savingsPercent: `${((totalSavings / costWithoutCache) * 100).toFixed(1)}%`
      },
      recommendation: this.getRecommendation(stats.hitRate)
    };
  }

  private getRecommendation(hitRate: string): string {
    const rate = parseFloat(hitRate);

    if (rate > 80) {
      return 'Excellent cache performance! Consider increasing TTLs for more savings.';
    } else if (rate > 60) {
      return 'Good cache performance. Monitor invalidation patterns.';
    } else if (rate > 40) {
      return 'Moderate cache performance. Review cache key generation logic.';
    } else {
      return 'Low cache hit rate. Investigate: Are queries too unique? Is TTL too short?';
    }
  }

  /**
   * Get cache performance report
   */
  async getReport(): Promise<any> {
    const stats = this.cacheService.getStats();
    const savings = await this.calculateSavings('day');

    return {
      timestamp: new Date().toISOString(),
      performance: {
        hitRate: stats.hitRate,
        totalRequests: stats.total,
        cacheHits: stats.hits,
        cacheMisses: stats.misses
      },
      savings: savings.costs,
      recommendation: savings.recommendation
    };
  }
}
```

### 4. Cache Warming Script

**File**: `backend/scripts/warm-ai-cache.ts`

```typescript
import { AiService } from '../src/services/ai/AiService';
import { AiCacheService } from '../src/services/ai/AiCacheService';

/**
 * Pre-warm AI cache with common queries
 */
async function warmCache() {
  const aiService = new AiService();
  const cacheService = new AiCacheService();

  console.log('Starting cache warm-up...');

  // Permission explanation: Common denial scenarios
  const permissionQueries = [
    { userId: 'viewer-user', action: 'pfa:delete' },
    { userId: 'editor-user', action: 'pems:sync' },
    { userId: 'viewer-user', action: 'pfa:write' }
  ];

  for (const query of permissionQueries) {
    await aiService.explainPermissionDenial(query);
    console.log(`Cached permission explanation for ${query.action}`);
  }

  // BEO analytics: Common executive queries
  const beoQueries = [
    'Which projects are over budget?',
    'Portfolio variance summary',
    'Top 5 cost drivers'
  ];

  for (const query of beoQueries) {
    await aiService.beoAnalytics({ query, userId: 'cfo-user', responseFormat: 'conversational' });
    console.log(`Cached BEO query: ${query}`);
  }

  // Semantic audit search: Common searches
  const auditQueries = [
    'Who modified PFA records yesterday?',
    'Show me permission changes last week',
    'Bulk operations in the last month'
  ];

  for (const query of auditQueries) {
    await aiService.semanticAuditSearch({ query, userId: 'admin-user', organizationId: 'org-456' });
    console.log(`Cached audit search: ${query}`);
  }

  const stats = cacheService.getStats();
  console.log(`\nCache warm-up complete!`);
  console.log(`Total cached responses: ${stats.total}`);
}

warmCache().catch(console.error);
```

## Acceptance Criteria

- [ ] Redis caching implemented for all 25 AI use cases
- [ ] TTL configured per use case (15 min permission, 5 min audit, etc.)
- [ ] Cache invalidation triggers on data mutations (permission changes, PFA updates)
- [ ] Cache hit rate >80% after 24 hours of operation
- [ ] Cost savings >50% vs no caching
- [ ] Monitoring dashboard shows real-time cache stats

## Testing

```bash
# Test cache functionality
npm run test:ai-cache

# Warm cache with common queries
npm run cache:warm

# View cache stats
npm run cache:stats

# Clear cache
npm run cache:clear
```

## Success Metrics

- ✅ **Hit Rate**: >80% after 24 hours
- ✅ **Cost Savings**: >50% reduction in AI API costs
- ✅ **Latency Improvement**: 90%+ faster for cached responses
- ✅ **Invalidation**: <1% stale responses (invalidate on mutations)
- ✅ **Monitoring**: Real-time dashboard operational

---

# 🎯 Task 9.4: AI Error Handling & Fallbacks

**Agent**: `backend-architecture-optimizer`
**Duration**: 4 hours
**Priority**: P0 (CRITICAL - Reliability)

## Context

You are the Backend Architecture Optimizer responsible for implementing graceful degradation when AI is unavailable. Your goal is to ensure 99.9% uptime with rule-based fallbacks, retry logic, and manual override paths.

## Objectives

1. ✅ Implement graceful degradation when AI unavailable
2. ✅ Create rule-based fallbacks for critical features
3. ✅ Add user-friendly error messages
4. ✅ Implement retry logic with exponential backoff
5. ✅ Add manual override paths (users can bypass AI suggestions)
6. ✅ Monitor AI health and availability

## Source Documents

**Primary References**:
- `docs/ADRs/ADR-005-multi-tenant-access-control/ADR-005-IMPLEMENTATION_PLAN.md` (Phase 9.4 specs)

## Deliverables

### 1. AI Orchestrator with Fallback Logic

**File**: `backend/src/services/ai/AiOrchestrator.ts`

```typescript
import { AiProvider } from '../types/ai';

interface CallOptions {
  primaryProvider: AiProvider;
  fallbackProvider?: AiProvider;
  prompt: string;
  responseFormat: 'json' | 'text';
  maxRetries?: number;
  timeout?: number; // milliseconds
}

/**
 * AI orchestrator with fallback and error handling
 */
export class AiOrchestrator {
  /**
   * Call AI with automatic fallback on failure
   */
  async callWithFallback(options: CallOptions): Promise<any> {
    const { primaryProvider, fallbackProvider, maxRetries = 3 } = options;

    try {
      // Try primary provider with retries
      return await this.callWithRetry(primaryProvider, options, maxRetries);
    } catch (primaryError) {
      console.error(`Primary provider (${primaryProvider}) failed:`, primaryError);

      // Try fallback provider if configured
      if (fallbackProvider) {
        console.log(`Attempting fallback provider: ${fallbackProvider}`);
        try {
          return await this.callWithRetry(fallbackProvider, options, maxRetries);
        } catch (fallbackError) {
          console.error(`Fallback provider (${fallbackProvider}) failed:`, fallbackError);
          throw new Error(`All AI providers failed: ${primaryError.message}`);
        }
      } else {
        throw primaryError;
      }
    }
  }

  /**
   * Call AI with exponential backoff retries
   */
  private async callWithRetry(
    provider: AiProvider,
    options: CallOptions,
    maxRetries: number
  ): Promise<any> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.callAI(provider, options);
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = this.calculateBackoff(attempt);
          console.log(`Retry ${attempt}/${maxRetries} after ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  /**
   * Make AI API call with timeout
   */
  private async callAI(provider: AiProvider, options: CallOptions): Promise<any> {
    const timeout = options.timeout || 10000; // 10 second default

    return Promise.race([
      this.makeApiCall(provider, options),
      this.timeoutPromise(timeout)
    ]);
  }

  private async makeApiCall(provider: AiProvider, options: CallOptions): Promise<any> {
    // Implementation would call actual AI providers (Gemini, OpenAI, Claude)
    // Placeholder for now
    throw new Error('AI provider not implemented');
  }

  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI request timeout')), ms)
    );
  }

  private calculateBackoff(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s...
    return Math.min(1000 * Math.pow(2, attempt - 1), 10000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 2. Rule-Based Fallbacks

**File**: `backend/src/services/ai/fallbacks/RuleBasedFallbacks.ts`

```typescript
/**
 * Rule-based fallbacks when AI is unavailable
 */
export class RuleBasedFallbacks {
  /**
   * UC-16: Permission Explanation Fallback
   */
  explainPermissionDenial(params: {
    userId: string;
    action: string;
    userPermissions: any;
  }): any {
    const { action, userPermissions } = params;

    // Simple rule-based explanation
    const requiredPermissions = this.getRequiredPermissions(action);
    const missingPermissions = requiredPermissions.filter(
      perm => !userPermissions[perm]
    );

    return {
      permissionChain: missingPermissions.map(perm => ({
        check: `User has ${perm} capability`,
        result: false,
        reason: 'Permission not granted'
      })),
      actionableSteps: [
        {
          action: 'Contact your administrator to request access',
          contact: 'admin@example.com',
          eta: '1-2 business days'
        }
      ],
      estimatedResolutionTime: '1-2 business days',
      confidence: 0.70, // Lower confidence for rule-based
      fallbackMode: true
    };
  }

  /**
   * UC-17: Financial Masking Fallback
   */
  translateFinancialData(params: {
    records: any[];
    userCapabilities: any;
  }): any {
    const { records, userCapabilities } = params;

    if (userCapabilities.viewFinancialDetails) {
      // User can see financials - no masking needed
      return { maskedRecords: records, fallbackMode: true };
    }

    // Simple masking: Hide absolute costs, show relative categories
    const maskedRecords = records.map(record => ({
      ...record,
      cost: '***masked***',
      monthlyRate: '***masked***',
      purchasePrice: '***masked***',
      impactLevel: this.categorizeImpact(record.category), // Simple category-based
      fallbackMode: true
    }));

    return {
      maskedRecords,
      portfolioInsight: `${records.length} records (financial details masked)`,
      confidence: 0.70,
      fallbackMode: true
    };
  }

  /**
   * UC-21: BEO Analytics Fallback
   */
  beoAnalytics(params: { query: string; portfolioData: any }): any {
    return {
      narrative: 'AI service is temporarily unavailable. Please try again in a few moments.',
      executiveSummary: {
        portfolioVariance: 'N/A',
        projectsAtRisk: 'N/A',
        status: 'AI_UNAVAILABLE'
      },
      detailedBreakdown: [],
      confidence: 0,
      fallbackMode: true,
      recommendation: 'Use manual portfolio analysis or contact your administrator.'
    };
  }

  /**
   * Map actions to required permissions
   */
  private getRequiredPermissions(action: string): string[] {
    const permissionMap: Record<string, string[]> = {
      'pfa:write': ['canWrite'],
      'pfa:delete': ['canDelete'],
      'pems:sync': ['canSync'],
      'user:manage': ['canManageUsers'],
      'settings:manage': ['canManageSettings']
    };

    return permissionMap[action] || [];
  }

  /**
   * Simple impact categorization
   */
  private categorizeImpact(category: string): 'HIGH' | 'MEDIUM' | 'LOW' {
    const highImpactCategories = ['Cranes', 'Heavy Equipment', 'Specialized Machinery'];
    const mediumImpactCategories = ['Generators', 'Pumps', 'Compressors'];

    if (highImpactCategories.includes(category)) return 'HIGH';
    if (mediumImpactCategories.includes(category)) return 'MEDIUM';
    return 'LOW';
  }
}
```

### 3. User-Friendly Error Messages

**File**: `backend/src/services/ai/AiErrorHandler.ts`

```typescript
/**
 * Convert AI errors to user-friendly messages
 */
export class AiErrorHandler {
  /**
   * Get user-friendly error message
   */
  getUserMessage(error: Error, useCase: string): string {
    const errorType = this.categorizeError(error);

    const messages: Record<string, string> = {
      TIMEOUT: 'Our AI assistant is taking longer than expected. Please try again in a moment.',
      RATE_LIMIT: 'Too many requests. Please wait a moment and try again.',
      PROVIDER_ERROR: 'Our AI service is temporarily unavailable. Using simplified analysis.',
      INVALID_RESPONSE: 'We received an unexpected response. Please try again.',
      NETWORK_ERROR: 'Network connection issue. Please check your internet connection.',
      UNKNOWN: 'An unexpected error occurred. Please try again or contact support.'
    };

    return messages[errorType] || messages.UNKNOWN;
  }

  /**
   * Get admin-facing error details
   */
  getAdminMessage(error: Error, useCase: string): any {
    return {
      timestamp: new Date().toISOString(),
      useCase,
      errorType: this.categorizeError(error),
      errorMessage: error.message,
      stack: error.stack,
      recommendation: this.getRecommendation(error)
    };
  }

  private categorizeError(error: Error): string {
    if (error.message.includes('timeout')) return 'TIMEOUT';
    if (error.message.includes('rate limit')) return 'RATE_LIMIT';
    if (error.message.includes('provider')) return 'PROVIDER_ERROR';
    if (error.message.includes('invalid')) return 'INVALID_RESPONSE';
    if (error.message.includes('network')) return 'NETWORK_ERROR';
    return 'UNKNOWN';
  }

  private getRecommendation(error: Error): string {
    const errorType = this.categorizeError(error);

    const recommendations: Record<string, string> = {
      TIMEOUT: 'Check AI provider status. Consider increasing timeout threshold.',
      RATE_LIMIT: 'Implement request queuing or upgrade AI provider plan.',
      PROVIDER_ERROR: 'Check AI provider health dashboard. Ensure API keys are valid.',
      INVALID_RESPONSE: 'Review prompt template. AI response may not match expected format.',
      NETWORK_ERROR: 'Check network connectivity. Verify AI provider endpoint is reachable.',
      UNKNOWN: 'Review error logs. Contact AI provider support if issue persists.'
    };

    return recommendations[errorType] || recommendations.UNKNOWN;
  }
}
```

### 4. AI Health Monitoring

**File**: `backend/src/services/ai/AiHealthMonitor.ts`

```typescript
import { EventEmitter } from 'events';

interface HealthStatus {
  provider: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  errorRate: number;
  lastCheck: Date;
}

/**
 * Monitor AI provider health
 */
export class AiHealthMonitor extends EventEmitter {
  private healthStatus: Map<string, HealthStatus> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * Start health monitoring
   */
  start(intervalMs: number = 60000) {
    console.log('Starting AI health monitoring...');

    this.checkInterval = setInterval(() => {
      this.checkAllProviders();
    }, intervalMs);

    // Initial check
    this.checkAllProviders();
  }

  /**
   * Stop health monitoring
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check health of all AI providers
   */
  private async checkAllProviders() {
    const providers = ['gemini', 'openai', 'claude'];

    for (const provider of providers) {
      try {
        const health = await this.checkProvider(provider);
        this.healthStatus.set(provider, health);

        if (health.status === 'down') {
          this.emit('provider-down', { provider, health });
        } else if (health.status === 'degraded') {
          this.emit('provider-degraded', { provider, health });
        }
      } catch (error) {
        console.error(`Health check failed for ${provider}:`, error);
      }
    }
  }

  /**
   * Check health of single provider
   */
  private async checkProvider(provider: string): Promise<HealthStatus> {
    const start = Date.now();
    let status: 'healthy' | 'degraded' | 'down' = 'healthy';
    let errorRate = 0;

    try {
      // Make lightweight health check request
      await this.makeHealthCheckRequest(provider);

      const latency = Date.now() - start;

      // Determine status based on latency
      if (latency > 5000) {
        status = 'degraded';
      } else if (latency > 10000) {
        status = 'down';
      }

      return {
        provider,
        status,
        latency,
        errorRate,
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        provider,
        status: 'down',
        latency: Date.now() - start,
        errorRate: 1.0,
        lastCheck: new Date()
      };
    }
  }

  private async makeHealthCheckRequest(provider: string): Promise<void> {
    // Placeholder - would make actual health check API call
    // For now, simulate success
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Get current health status
   */
  getStatus(): HealthStatus[] {
    return Array.from(this.healthStatus.values());
  }

  /**
   * Get health summary
   */
  getSummary(): any {
    const statuses = this.getStatus();

    return {
      timestamp: new Date().toISOString(),
      overall: this.calculateOverallHealth(statuses),
      providers: statuses
    };
  }

  private calculateOverallHealth(statuses: HealthStatus[]): 'healthy' | 'degraded' | 'down' {
    const downCount = statuses.filter(s => s.status === 'down').length;
    const degradedCount = statuses.filter(s => s.status === 'degraded').length;

    if (downCount === statuses.length) return 'down';
    if (downCount > 0 || degradedCount > statuses.length / 2) return 'degraded';
    return 'healthy';
  }
}
```

### 5. Manual Override UI Component

**File**: `components/AiSuggestionCard.tsx`

```typescript
import React, { useState } from 'react';

interface AiSuggestionProps {
  suggestion: any;
  onAccept: () => void;
  onReject: () => void;
  onManualOverride: () => void;
  confidence: number;
}

/**
 * Display AI suggestion with manual override option
 */
export function AiSuggestionCard({
  suggestion,
  onAccept,
  onReject,
  onManualOverride,
  confidence
}: AiSuggestionProps) {
  const [showManualOverride, setShowManualOverride] = useState(false);

  return (
    <div className="border rounded-lg p-4 bg-blue-50">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-blue-900">AI Suggestion</h3>
          <p className="text-sm text-blue-700 mt-1">{suggestion.message}</p>

          {confidence < 0.85 && (
            <div className="mt-2 text-xs text-yellow-600">
              ⚠️ Confidence: {(confidence * 100).toFixed(0)}% (Lower than usual)
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={onAccept} className="btn-sm btn-primary">
            Accept
          </button>
          <button onClick={onReject} className="btn-sm btn-secondary">
            Reject
          </button>
        </div>
      </div>

      {/* Manual Override Option */}
      <div className="mt-3 pt-3 border-t border-blue-200">
        {!showManualOverride ? (
          <button
            onClick={() => setShowManualOverride(true)}
            className="text-sm text-blue-600 hover:underline"
          >
            Or configure manually
          </button>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-2">
              Bypass AI suggestion and configure settings yourself:
            </p>
            <button
              onClick={onManualOverride}
              className="btn-sm btn-primary"
            >
              Manual Configuration
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

## Acceptance Criteria

- [ ] Graceful degradation implemented for all 25 AI use cases
- [ ] Rule-based fallbacks operational (permission explanation, financial masking)
- [ ] Retry logic with exponential backoff (max 3 retries)
- [ ] User-friendly error messages for all AI failures
- [ ] Manual override paths available (users can bypass AI)
- [ ] AI health monitoring dashboard (check every 60 seconds)
- [ ] Alerts configured for provider outages

## Testing

```bash
# Test AI fallbacks
npm run test:ai-fallbacks

# Simulate AI outage
npm run ai:simulate-outage

# View health status
npm run ai:health

# Test error handling
npm run test:ai-errors
```

## Success Metrics

- ✅ **Uptime**: 99.9% availability with fallbacks
- ✅ **Error Recovery**: <1% user-facing errors
- ✅ **Retry Success**: >80% of retries succeed
- ✅ **Fallback Usage**: <5% requests use fallbacks
- ✅ **User Satisfaction**: >90% users can bypass AI when needed

---

## 🎯 Phase 9 Completion Checklist

**Overall Phase Status**: All 4 tasks complete when:

- [ ] **Task 9.1**: AI Model Performance Tuning COMPLETE
  - [ ] All 25 use cases benchmarked
  - [ ] P95 latency <500ms across the board
  - [ ] Accuracy >85% for all classification tasks
  - [ ] A/B testing framework operational
  - [ ] Cost reduction >50% achieved

- [ ] **Task 9.2**: AI Prompt Engineering COMPLETE
  - [ ] 25/25 prompts optimized and version-controlled
  - [ ] Few-shot examples added for complex use cases
  - [ ] Confidence thresholds enforced
  - [ ] Prompt testing framework with >80% coverage

- [ ] **Task 9.3**: AI Caching Strategy COMPLETE
  - [ ] Redis caching implemented for all use cases
  - [ ] Cache hit rate >80%
  - [ ] Invalidation triggers on mutations
  - [ ] Cost savings >50% confirmed

- [ ] **Task 9.4**: AI Error Handling & Fallbacks COMPLETE
  - [ ] Graceful degradation for all use cases
  - [ ] Rule-based fallbacks operational
  - [ ] Retry logic with exponential backoff
  - [ ] AI health monitoring dashboard live

**Next Phase**: Phase 10 (Security & QA) - Security red-teaming and comprehensive testing

---

**Document Generated**: 2025-11-27
**Total Length**: ~1,800 lines (600-1500 per task bundle)
**Status**: Ready for agent execution

---

## 🛡️ Phase 10: Security & QA Gates

**Duration**: 2 days | **Mode**: Parallel Execution | **Prerequisites**: Phase 9 Complete

---

# ADR-005: Phase 10A Prompt Bundles - Security Red Team Gate

**Phase**: 10A (Security Red Team Testing)
**Duration**: 1.5 days
**Agent**: ai-security-red-teamer
**Status**: Ready for Execution
**Prerequisites**: Phase 9 Complete (All AI features implemented)

---

## 📋 Phase 10A Task Index

| Task ID | Task Name | Agent | Duration | Status |
|---------|-----------|-------|----------|--------|
| **10A.1** | Privilege Escalation Testing | ai-security-red-teamer | 3 hours | Ready |
| **10A.2** | Cross-Organization Access Testing (IDOR) | ai-security-red-teamer | 3 hours | Ready |
| **10A.3** | Financial Masking Bypass Testing | ai-security-red-teamer | 3 hours | Ready |
| **10A.4** | API Server Security Audit | ai-security-red-teamer | 3 hours | Ready |
| 10A.5 | JWT Tampering & Token Integrity Testing | ai-security-red-teamer | 2 hours | ✅ Bundle in PHASE_10_PROMPT_BUNDLES.md |
| 10A.6 | Rate Limiting & Account Lockout Testing | ai-security-red-teamer | 2 hours | ✅ Bundle in PHASE_10_PROMPT_BUNDLES.md |

**Total Phase Duration**: 1.5 days (12 hours)

---

## 🎯 Phase 10A Overview

**Purpose**: Security gate before QA testing - adversarial testing to identify privilege escalation, IDOR vulnerabilities, financial masking bypasses, and API server security issues.

**Critical Success Criteria**:
- ✅ All privilege escalation attack vectors documented and tested
- ✅ Cross-organization access controls validated
- ✅ Financial masking bypass attempts detected and blocked
- ✅ API server authorization vulnerabilities identified
- ✅ Automated security test suites created for regression testing
- ✅ Security audit report generated with remediation recommendations

**Output Artifacts**:
- Integration test suites for each vulnerability class
- SECURITY_AUDIT_REPORT.md with findings and remediation steps
- Automated regression test suite
- Security compliance checklist

---

# Task 10A.1: Privilege Escalation Testing

**Agent**: ai-security-red-teamer
**Duration**: 3 hours
**Prerequisites**: Phase 9 Complete
**Deliverables**:
- Privilege escalation attack test suite
- Vulnerability report
- Remediation recommendations

---

## 📦 Self-Contained Prompt Bundle

```markdown
# TASK: Privilege Escalation Security Testing - ADR-005

## Your Role
You are the **ai-security-red-teamer** agent responsible for adversarial security testing of the Multi-Tenant Access Control system. Your mission is to identify and document privilege escalation vulnerabilities before production deployment.

## Context: What Has Been Built

### System Architecture
The PFA Vanguard application has implemented a sophisticated multi-tenant access control system with:

**User Capabilities** (14 permission flags):
- `canViewOrgData` - View organization data
- `canEditPfaRecords` - Edit PFA records
- `canDeletePfaRecords` - Delete PFA records
- `canManageUsers` - Create/edit users
- `canManageOrganizations` - Manage organizations
- `perm_ManageSettings` - Manage API servers and system settings
- `perm_ViewAuditLogs` - View audit logs
- `perm_ExportData` - Export data
- `perm_ImportData` - Import data
- `perm_ManageRoles` - Manage roles
- `perm_TriggerSync` - Trigger PEMS sync
- `perm_BulkOperations` - Perform bulk operations
- `perm_ApproveChanges` - Approve changes
- `viewFinancialDetails` - View financial data (costs)

**Role System**:
- Predefined roles: Admin, BEO User, Field Engineer, Accountant, Viewer
- Hybrid role-override model: Role defines baseline, capabilities allow custom overrides
- Role drift detection: AI identifies patterns of consistent overrides

**Database Tables**:
- `User`: Contains `capabilities` JSONB field + `role` field
- `UserOrganization`: Many-to-many relationship with per-org role assignments
- `Organization`: Has `serviceStatus` field (active/suspended)
- `ApiServer`: Requires `perm_ManageSettings` permission for CRUD
- `AuditLog`: Tracks all permission changes

**Middleware**:
- `requirePermission(capability)` - Guards routes by permission
- `requireApiServerPermission()` - Guards API server operations
- JWT tokens contain: `userId`, `username`, `role`, `organizationIds[]`

### Attack Surface

**Critical Threat Vectors**:
1. **Role Manipulation**: User modifies their own role via database or API
2. **Capability Injection**: User adds permissions to their JWT token
3. **Token Tampering**: User modifies JWT claims to grant themselves admin
4. **Database Direct Access**: User bypasses API to modify `capabilities` JSON
5. **API Parameter Manipulation**: User changes `role` in request body during account update
6. **Session Hijacking**: User steals admin token and escalates privileges
7. **Permission Cache Poisoning**: User exploits caching to retain revoked permissions

## Your Mission

**Primary Objective**: Test every attack vector that could allow a non-admin user to escalate their privileges.

**Attack Scenarios to Test**:

### Scenario 1: Viewer Attempts to Grant Admin Role
**Initial State**: User has `role: 'Viewer'`, no write permissions
**Attack**: User calls `PATCH /api/users/{self}` with `{ role: 'Admin' }`
**Expected Defense**: 403 Forbidden - "Cannot modify your own role"

### Scenario 2: User Grants Themselves perm_ManageSettings
**Initial State**: User has `perm_ManageSettings: false`
**Attack**: User calls `PATCH /api/users/{self}` with `{ capabilities: { perm_ManageSettings: true } }`
**Expected Defense**: 403 Forbidden - "Requires perm_ManageRoles permission"

### Scenario 3: Capability Manipulation via Token Tampering
**Initial State**: User has valid JWT token with limited capabilities
**Attack**: User decodes JWT, adds `"perm_ManageSettings": true` to payload, re-encodes with guessed secret
**Expected Defense**: 401 Unauthorized - JWT signature verification fails

### Scenario 4: Database Direct Modification
**Initial State**: User has database read access (vulnerability)
**Attack**: User executes `UPDATE users SET capabilities = '{"perm_ManageSettings": true}' WHERE id = 'attacker-id'`
**Expected Defense**: Database-level permissions prevent write access OR application-level validation detects tampering

### Scenario 5: API Parameter Manipulation
**Initial State**: User submits form to update their profile
**Attack**: User intercepts request and adds `role: 'Admin'` to JSON body
**Expected Defense**: Backend strips `role` field from self-update requests

### Scenario 6: Permission Bypass via Stale Token
**Initial State**: Admin grants user `perm_ManageSettings`, then immediately revokes it
**Attack**: User's cached token still has permission for next 5 minutes
**Expected Defense**: Permission re-check on every request OR short token TTL

### Scenario 7: Exploiting Role Drift Auto-Migration
**Initial State**: System detects role drift and suggests new role
**Attack**: User manipulates recommendation API to grant themselves admin capabilities
**Expected Defense**: Role creation requires `perm_ManageRoles` permission

## Deliverables

### 1. Integration Test Suite

Create comprehensive test file at `backend/tests/integration/privilegeEscalation.test.ts`:

```typescript
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../../src/server';
import { prisma } from '../../src/config/database';
import { createUser, loginAs, createOrganization } from '../helpers/testHelpers';

describe('Security: Privilege Escalation Prevention', () => {
  let viewerToken: string;
  let viewerUser: any;
  let editorToken: string;
  let editorUser: any;
  let adminToken: string;

  beforeAll(async () => {
    // Setup test users
    viewerUser = await createUser({
      username: 'viewer-test',
      email: 'viewer@test.com',
      role: 'Viewer',
      capabilities: {
        canViewOrgData: true,
        canEditPfaRecords: false,
        canManageUsers: false,
        perm_ManageSettings: false
      }
    });
    viewerToken = await loginAs('viewer-test', 'password');

    editorUser = await createUser({
      username: 'editor-test',
      email: 'editor@test.com',
      role: 'Field Engineer',
      capabilities: {
        canViewOrgData: true,
        canEditPfaRecords: true,
        canManageUsers: false,
        perm_ManageSettings: false
      }
    });
    editorToken = await loginAs('editor-test', 'password');

    adminToken = await loginAs('admin', 'admin123');
  });

  afterAll(async () => {
    // Cleanup test users
    await prisma.user.deleteMany({
      where: { email: { in: ['viewer@test.com', 'editor@test.com'] } }
    });
  });

  describe('ATTACK-PE-001: Self Role Modification', () => {
    it('should prevent viewer from changing their own role to Admin', async () => {
      const response = await request(app)
        .patch(`/api/users/${viewerUser.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ role: 'Admin' });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Cannot modify your own role');

      // Verify role unchanged
      const user = await prisma.user.findUnique({ where: { id: viewerUser.id } });
      expect(user.role).toBe('Viewer');
    });

    it('should prevent viewer from changing their own role to BEO User', async () => {
      const response = await request(app)
        .patch(`/api/users/${viewerUser.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ role: 'BEO User' });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Cannot modify your own role');
    });
  });

  describe('ATTACK-PE-002: Self Permission Grant', () => {
    it('should prevent user from granting themselves perm_ManageSettings', async () => {
      const response = await request(app)
        .patch(`/api/users/${editorUser.id}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          capabilities: {
            perm_ManageSettings: true
          }
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('perm_ManageRoles');

      // Verify permission unchanged
      const user = await prisma.user.findUnique({ where: { id: editorUser.id } });
      expect(user.capabilities.perm_ManageSettings).toBe(false);
    });

    it('should prevent user from granting themselves canManageUsers', async () => {
      const response = await request(app)
        .patch(`/api/users/${viewerUser.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          capabilities: {
            canManageUsers: true,
            perm_ManageRoles: true
          }
        });

      expect(response.status).toBe(403);

      // Verify permissions unchanged
      const user = await prisma.user.findUnique({ where: { id: viewerUser.id } });
      expect(user.capabilities.canManageUsers).toBeFalsy();
      expect(user.capabilities.perm_ManageRoles).toBeFalsy();
    });
  });

  describe('ATTACK-PE-003: Token Tampering', () => {
    it('should reject JWT with modified capabilities claim', async () => {
      // Attempt to use a JWT with tampered capabilities
      const tamperedToken = viewerToken.replace('Viewer', 'Admin'); // Naive tampering

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/invalid.*token|unauthorized/i);
    });

    it('should reject expired tokens even if capabilities are valid', async () => {
      // Generate expired token (requires test helper)
      const expiredToken = generateExpiredToken(viewerUser.id);

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('TOKEN_EXPIRED');
    });
  });

  describe('ATTACK-PE-004: API Parameter Injection', () => {
    it('should strip role field from self-update requests', async () => {
      const response = await request(app)
        .patch(`/api/users/${editorUser.id}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          displayName: 'Updated Name',
          role: 'Admin', // Injected field
          capabilities: { perm_ManageSettings: true } // Also injected
        });

      // Either 403 (permission denied) OR 200 (but role/capabilities ignored)
      if (response.status === 200) {
        const user = await prisma.user.findUnique({ where: { id: editorUser.id } });
        expect(user.role).toBe('Field Engineer'); // Unchanged
        expect(user.capabilities.perm_ManageSettings).toBe(false); // Unchanged
      } else {
        expect(response.status).toBe(403);
      }
    });

    it('should prevent role field injection via multipart form data', async () => {
      const response = await request(app)
        .patch(`/api/users/${viewerUser.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .field('role', 'Admin')
        .field('displayName', 'Hacker');

      expect(response.status).toBe(403);

      const user = await prisma.user.findUnique({ where: { id: viewerUser.id } });
      expect(user.role).toBe('Viewer');
    });
  });

  describe('ATTACK-PE-005: Permission Cache Exploitation', () => {
    it('should revalidate permissions after revocation', async () => {
      // Admin grants permission
      await request(app)
        .patch(`/api/users/${editorUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          capabilities: {
            perm_ManageSettings: true
          }
        });

      // User performs action (should succeed)
      let response = await request(app)
        .get('/api/api-servers')
        .set('Authorization', `Bearer ${editorToken}`);
      expect(response.status).toBe(200);

      // Admin revokes permission
      await request(app)
        .patch(`/api/users/${editorUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          capabilities: {
            perm_ManageSettings: false
          }
        });

      // User attempts same action (should fail immediately or within 5 min)
      response = await request(app)
        .get('/api/api-servers')
        .set('Authorization', `Bearer ${editorToken}`);

      // If using cached token, this MIGHT be 200 (acceptable if TTL < 5 min)
      // But if re-checking DB on every request, should be 403
      if (response.status === 200) {
        console.warn('⚠️ WARNING: Permissions cached in JWT token - revocation not immediate');
        console.warn('   Recommendation: Reduce token TTL or implement token revocation list');
      }
      // After token refresh, should definitely fail
      const newToken = await loginAs('editor-test', 'password');
      response = await request(app)
        .get('/api/api-servers')
        .set('Authorization', `Bearer ${newToken}`);
      expect(response.status).toBe(403);
    });
  });

  describe('ATTACK-PE-006: Exploiting Admin Endpoints', () => {
    it('should prevent non-admin from creating API server for other org', async () => {
      const otherOrg = await createOrganization({ code: 'OTHER', name: 'Other Org' });

      const response = await request(app)
        .post('/api/api-servers')
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          organizationId: otherOrg.id,
          name: 'Malicious Server',
          baseUrl: 'https://evil.com',
          authType: 'bearer'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/permission|unauthorized/i);
    });

    it('should prevent user from suspending organization', async () => {
      const org = await createOrganization({ code: 'TEST', name: 'Test Org' });

      const response = await request(app)
        .patch(`/api/organizations/${org.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ serviceStatus: 'suspended' });

      expect(response.status).toBe(403);

      // Verify org not suspended
      const updatedOrg = await prisma.organization.findUnique({ where: { id: org.id } });
      expect(updatedOrg.serviceStatus).not.toBe('suspended');
    });
  });

  describe('ATTACK-PE-007: Database Constraint Bypass', () => {
    it('should validate capabilities JSON structure', async () => {
      // Attempt to send malformed capabilities
      const response = await request(app)
        .patch(`/api/users/${editorUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`) // Admin making change
        .send({
          capabilities: 'INVALID_JSON' // Not a JSON object
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('capabilities must be an object');
    });

    it('should reject unknown capability flags', async () => {
      const response = await request(app)
        .patch(`/api/users/${editorUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          capabilities: {
            canViewOrgData: true,
            UNKNOWN_CAPABILITY: true, // Invalid capability
            hackerAccess: true // Another invalid one
          }
        });

      // Either 400 (validation error) OR capabilities stripped to known fields only
      if (response.status === 400) {
        expect(response.body.error).toContain('unknown');
      } else if (response.status === 200) {
        const user = await prisma.user.findUnique({ where: { id: editorUser.id } });
        expect(user.capabilities).not.toHaveProperty('UNKNOWN_CAPABILITY');
        expect(user.capabilities).not.toHaveProperty('hackerAccess');
      }
    });
  });

  describe('ATTACK-PE-008: Concurrent Modification Race Condition', () => {
    it('should handle concurrent permission grants safely', async () => {
      // Two admins grant different permissions simultaneously
      const promises = [
        request(app)
          .patch(`/api/users/${editorUser.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ capabilities: { perm_TriggerSync: true } }),
        request(app)
          .patch(`/api/users/${editorUser.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ capabilities: { perm_BulkOperations: true } })
      ];

      const results = await Promise.all(promises);
      results.forEach(r => expect(r.status).toBeLessThan(500)); // No server errors

      // Verify both permissions granted OR last-write-wins
      const user = await prisma.user.findUnique({ where: { id: editorUser.id } });
      // Both should be true OR one of them (depends on implementation)
      expect(
        user.capabilities.perm_TriggerSync === true ||
        user.capabilities.perm_BulkOperations === true
      ).toBe(true);
    });
  });
});
```

### 2. Vulnerability Report

Create `docs/security/PRIVILEGE_ESCALATION_AUDIT.md`:

```markdown
# Privilege Escalation Security Audit Report

**Audit Date**: [Current Date]
**Auditor**: ai-security-red-teamer
**System**: PFA Vanguard Multi-Tenant Access Control
**Scope**: ADR-005 Privilege Escalation Attack Vectors

---

## Executive Summary

**Total Attack Vectors Tested**: 8 categories, 18 test scenarios
**Critical Vulnerabilities Found**: [To be filled after running tests]
**High-Risk Vulnerabilities**: [To be filled]
**Medium-Risk Vulnerabilities**: [To be filled]
**Overall Security Rating**: [To be determined]

---

## Attack Vector Analysis

### 1. Self Role Modification (ATTACK-PE-001)
**Status**: [PASS/FAIL]
**Risk Level**: CRITICAL
**Test Results**:
- Viewer → Admin: [Result]
- Viewer → BEO User: [Result]

**Findings**:
[Document any vulnerabilities found]

**Remediation** (if needed):
- Ensure `requirePermission('perm_ManageRoles')` guards `/api/users/:id` PATCH endpoint
- Add validation: `if (req.user.id === params.id && 'role' in body) throw 403`

---

### 2. Self Permission Grant (ATTACK-PE-002)
**Status**: [PASS/FAIL]
**Risk Level**: CRITICAL
**Test Results**:
- Grant perm_ManageSettings: [Result]
- Grant canManageUsers: [Result]

**Findings**:
[Document any vulnerabilities found]

**Remediation** (if needed):
- Require `perm_ManageRoles` for any `capabilities` modifications
- Log all capability changes to audit log

---

### 3. Token Tampering (ATTACK-PE-003)
**Status**: [PASS/FAIL]
**Risk Level**: HIGH
**Test Results**:
- Modified capabilities claim: [Result]
- Expired token: [Result]

**Findings**:
[Document any vulnerabilities found]

**Remediation** (if needed):
- Ensure JWT secret is strong (32+ characters, random)
- Implement token rotation every 24 hours
- Add token revocation list (blacklist) for immediate revocation

---

### 4. API Parameter Injection (ATTACK-PE-004)
**Status**: [PASS/FAIL]
**Risk Level**: HIGH
**Test Results**:
- Role field injection: [Result]
- Capabilities field injection: [Result]

**Findings**:
[Document any vulnerabilities found]

**Remediation** (if needed):
- Implement input sanitization middleware
- Whitelist allowed fields for self-update requests
- Strip sensitive fields before processing

---

### 5. Permission Cache Exploitation (ATTACK-PE-005)
**Status**: [PASS/FAIL]
**Risk Level**: MEDIUM
**Test Results**:
- Revoked permission still active: [Result]
- Token TTL: [Current value]

**Findings**:
[Document if revoked permissions remain active for >5 minutes]

**Remediation** (if needed):
- Reduce JWT TTL to 15 minutes (currently 7 days in dev)
- Implement token revocation list
- Add permission re-check middleware on sensitive routes

---

### 6. Admin Endpoint Exploitation (ATTACK-PE-006)
**Status**: [PASS/FAIL]
**Risk Level**: CRITICAL
**Test Results**:
- Create API server for other org: [Result]
- Suspend organization: [Result]

**Findings**:
[Document any vulnerabilities found]

**Remediation** (if needed):
- Ensure all admin routes guarded by `requirePermission()`
- Add organization ownership validation for API server operations

---

### 7. Database Constraint Bypass (ATTACK-PE-007)
**Status**: [PASS/FAIL]
**Risk Level**: MEDIUM
**Test Results**:
- Malformed capabilities JSON: [Result]
- Unknown capability flags: [Result]

**Findings**:
[Document any vulnerabilities found]

**Remediation** (if needed):
- Add JSON schema validation for `capabilities` field
- Reject unknown capability flags OR strip them before saving

---

### 8. Concurrent Modification Race Condition (ATTACK-PE-008)
**Status**: [PASS/FAIL]
**Risk Level**: LOW
**Test Results**:
- Concurrent permission grants: [Result]

**Findings**:
[Document if data corruption or server errors occur]

**Remediation** (if needed):
- Implement database transaction isolation level `READ COMMITTED`
- Use optimistic locking (version field) for user updates

---

## Security Compliance Checklist

- [ ] All 18 test scenarios passing
- [ ] No critical vulnerabilities found
- [ ] No high-risk vulnerabilities found
- [ ] JWT token TTL < 1 hour (production)
- [ ] Token revocation implemented
- [ ] Audit logging enabled for all permission changes
- [ ] Input validation implemented for all user-modifiable fields
- [ ] Role modification restricted to admins only
- [ ] Permission grant restricted to users with `perm_ManageRoles`
- [ ] Database-level constraints prevent invalid capabilities

---

## Recommendations for Production Deployment

### Immediate Actions (P0)
1. [List critical fixes needed before production]

### High Priority (P1)
1. [List high-priority security enhancements]

### Medium Priority (P2)
1. [List medium-priority improvements]

---

## Appendix: Test Execution Log

[Paste complete test output here after running `npm run test:security`]
```

### 3. Remediation Implementation Guide

If vulnerabilities are found, create:

**File**: `docs/security/PRIVILEGE_ESCALATION_REMEDIATION.md`

```markdown
# Privilege Escalation Remediation Guide

## Critical Fix 1: [Vulnerability Name]

**Issue**: [Description]
**Risk**: CRITICAL
**Affected Code**: [File paths]

### Implementation

**Step 1**: Update middleware
```typescript
// backend/src/middleware/requirePermission.ts
export const preventSelfRoleModification = (req, res, next) => {
  if (req.params.id === req.user.id && 'role' in req.body) {
    return res.status(403).json({ error: 'Cannot modify your own role' });
  }
  next();
};
```

**Step 2**: Apply to route
```typescript
// backend/src/routes/userRoutes.ts
router.patch('/:id',
  authenticate,
  preventSelfRoleModification,
  requirePermission('perm_ManageRoles'),
  userController.updateUser
);
```

**Step 3**: Add test
```typescript
it('should prevent self role modification', async () => {
  // Test code here
});
```

**Step 4**: Verify fix
```bash
npm run test:security -- privilegeEscalation.test.ts
```

---

[Repeat for each vulnerability found]
```

## Success Criteria

✅ **Task Complete When**:
1. All 18 test scenarios implemented in `privilegeEscalation.test.ts`
2. All tests passing OR vulnerabilities documented in audit report
3. Security audit report generated with findings
4. Remediation guide created for any vulnerabilities found
5. Automated regression test suite integrated into CI/CD pipeline

## Validation Steps

After completing this task:

```bash
# Run privilege escalation tests
cd backend
npm run test:integration -- privilegeEscalation.test.ts

# Generate coverage report
npm run test:coverage

# Verify no critical vulnerabilities
cat docs/security/PRIVILEGE_ESCALATION_AUDIT.md | grep "Critical Vulnerabilities Found: 0"

# If vulnerabilities found, verify remediation implemented
npm run test:security -- privilegeEscalation.test.ts --verbose
```

## References

- **Test Plan**: ADR-005-TEST_PLAN.md lines 20-44 (Privilege Escalation Tests)
- **Implementation**: ADR-005-IMPLEMENTATION_PLAN.md Phase 2 (Backend Authorization)
- **Decision**: ADR-005-DECISION.md (Permission Model)

---

**Estimated Time**: 3 hours
**Dependencies**: Phase 9 complete (all AI features implemented)
**Blocker Risk**: NONE
**Agent Handoff**: → Task 10A.2 (Cross-Organization Access Testing)
```

---

# Task 10A.2: Cross-Organization Access Testing (IDOR)

**Agent**: ai-security-red-teamer
**Duration**: 3 hours
**Prerequisites**: Phase 9 Complete
**Deliverables**:
- IDOR attack test suite
- Multi-tenant isolation validation
- Security findings report

---

## 📦 Self-Contained Prompt Bundle

```markdown
# TASK: Cross-Organization Access Testing (IDOR) - ADR-005

## Your Role
You are the **ai-security-red-teamer** agent responsible for testing Insecure Direct Object Reference (IDOR) vulnerabilities in the multi-tenant PFA Vanguard system. Your mission is to verify that users cannot access data from organizations they don't belong to.

## Context: Multi-Tenant Architecture

### Organization Isolation Model
PFA Vanguard is a multi-tenant system where:

**Tenants**: Each construction project is an "Organization" (e.g., HOLNG, RIO, BECH, PEMS_Global)

**User-Organization Relationship**:
- Users can belong to multiple organizations: `User.allowedOrganizationIds[]`
- Users have a "current context" organization: `User.organizationId`
- Each user-org relationship has a role: `UserOrganization.role`

**Data Isolation**:
- PFA records: Each has `organizationId` field
- API servers: Each has `organizationId` field
- API endpoints: Belong to API servers (indirect org relationship)
- Users: Can access only data from their allowed organizations

**Database Schema**:
```prisma
model User {
  id                    String   @id
  organizationId        String   // Current context
  allowedOrganizationIds String[] // Organizations user can access
  role                  String
  capabilities          Json
  organizations         UserOrganization[]
}

model UserOrganization {
  id             String
  userId         String
  organizationId String
  role           String
  capabilities   Json?
  user           User         @relation(...)
  organization   Organization @relation(...)
}

model Organization {
  id            String @id
  code          String @unique
  name          String
  serviceStatus String @default("active")
  users         UserOrganization[]
  apiServers    ApiServer[]
  pfaRecords    PfaRecord[]
}

model ApiServer {
  id             String
  organizationId String
  name           String
  organization   Organization @relation(...)
}

model PfaRecord {
  id             String
  organizationId String
  organization   Organization @relation(...)
}
```

### Attack Surface

**Critical IDOR Vulnerabilities to Test**:
1. **Direct ID Access**: User guesses another org's resource ID
2. **Organization ID Manipulation**: User changes `organizationId` query param
3. **Context Switching Exploit**: User switches org context to unauthorized org
4. **Bulk Operation Cross-Org**: User includes records from other orgs in bulk update
5. **API Server IDOR**: User modifies/deletes another org's API server
6. **Audit Log Leak**: User views audit logs from other organizations

## Your Mission

**Primary Objective**: Test every IDOR attack vector to ensure organization data isolation is bulletproof.

**Attack Scenarios to Test**:

### Scenario 1: Direct PFA Record Access
**Initial State**: User in HOLNG tries to access RIO's PFA record
**Attack**: `GET /api/pfa/records/{rio-record-id}`
**Expected Defense**: 403 Forbidden - "You don't have access to this organization"

### Scenario 2: Organization ID Query Manipulation
**Initial State**: User in HOLNG requests PFA records
**Attack**: `GET /api/pfa/records?organizationId=RIO`
**Expected Defense**: 403 Forbidden OR empty result set (data filtered out)

### Scenario 3: API Server Direct Access
**Initial State**: User in BECH tries to edit HOLNG's API server
**Attack**: `PATCH /api/api-servers/{holng-server-id}` with `{ name: 'Hacked' }`
**Expected Defense**: 403 Forbidden - "You don't have permission to manage this organization's API servers"

### Scenario 4: Context Switch to Unauthorized Org
**Initial State**: User allowed for [HOLNG], attempts switch to RIO
**Attack**: `POST /api/users/switch-context` with `{ organizationId: 'RIO' }`
**Expected Defense**: 403 Forbidden - "Not authorized for organization RIO"

### Scenario 5: Bulk Operation Cross-Org Injection
**Initial State**: User in HOLNG performs bulk PFA update
**Attack**: Include RIO record IDs in bulk update payload
**Expected Defense**: Operation fails OR RIO records silently ignored

### Scenario 6: Audit Log Enumeration
**Initial State**: User in HOLNG views audit logs
**Attack**: `GET /api/audit-logs?organizationId=RIO`
**Expected Defense**: 403 Forbidden OR data filtered to only HOLNG logs

### Scenario 7: User Enumeration Attack
**Initial State**: Attacker guesses user IDs from other orgs
**Attack**: `GET /api/users/{rio-user-id}`
**Expected Defense**: 403 Forbidden OR 404 Not Found (indistinguishable from non-existent user)

## Deliverables

### 1. Integration Test Suite

Create comprehensive test file at `backend/tests/integration/idorMultiTenant.test.ts`:

```typescript
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../../src/server';
import { prisma } from '../../src/config/database';
import { createUser, loginAs, createOrganization, createPfaRecord, createApiServer } from '../helpers/testHelpers';

describe('Security: IDOR and Multi-Tenant Isolation', () => {
  let holngOrg: any;
  let rioOrg: any;
  let bechOrg: any;

  let holngUser: any;
  let holngToken: string;
  let rioUser: any;
  let rioToken: string;
  let multiOrgUser: any; // User in both HOLNG and RIO
  let multiOrgToken: string;

  let holngPfaRecord: any;
  let rioPfaRecord: any;
  let holngApiServer: any;
  let rioApiServer: any;

  beforeAll(async () => {
    // Create organizations
    holngOrg = await createOrganization({ code: 'HOLNG', name: 'Holcim Nigeria' });
    rioOrg = await createOrganization({ code: 'RIO', name: 'Rio Tinto' });
    bechOrg = await createOrganization({ code: 'BECH', name: 'Bechtel' });

    // Create users
    holngUser = await createUser({
      username: 'holng-user',
      email: 'holng@test.com',
      organizationId: holngOrg.id,
      allowedOrganizationIds: [holngOrg.id],
      role: 'Field Engineer',
      capabilities: { canViewOrgData: true, canEditPfaRecords: true, perm_ManageSettings: true }
    });
    holngToken = await loginAs('holng-user', 'password');

    rioUser = await createUser({
      username: 'rio-user',
      email: 'rio@test.com',
      organizationId: rioOrg.id,
      allowedOrganizationIds: [rioOrg.id],
      role: 'Field Engineer',
      capabilities: { canViewOrgData: true, canEditPfaRecords: true, perm_ManageSettings: true }
    });
    rioToken = await loginAs('rio-user', 'password');

    multiOrgUser = await createUser({
      username: 'multi-org-user',
      email: 'multi@test.com',
      organizationId: holngOrg.id, // Default context: HOLNG
      allowedOrganizationIds: [holngOrg.id, rioOrg.id],
      role: 'Field Engineer',
      capabilities: { canViewOrgData: true, canEditPfaRecords: true, perm_ManageSettings: true }
    });
    multiOrgToken = await loginAs('multi-org-user', 'password');

    // Create test data
    holngPfaRecord = await createPfaRecord({ organizationId: holngOrg.id, category: 'Cranes' });
    rioPfaRecord = await createPfaRecord({ organizationId: rioOrg.id, category: 'Excavators' });

    holngApiServer = await createApiServer({ organizationId: holngOrg.id, name: 'HOLNG Server' });
    rioApiServer = await createApiServer({ organizationId: rioOrg.id, name: 'RIO Server' });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.pfaRecord.deleteMany({ where: { id: { in: [holngPfaRecord.id, rioPfaRecord.id] } } });
    await prisma.apiServer.deleteMany({ where: { id: { in: [holngApiServer.id, rioApiServer.id] } } });
    await prisma.user.deleteMany({ where: { email: { in: ['holng@test.com', 'rio@test.com', 'multi@test.com'] } } });
    await prisma.organization.deleteMany({ where: { code: { in: ['HOLNG', 'RIO', 'BECH'] } } });
  });

  describe('ATTACK-IDOR-001: Direct PFA Record Access', () => {
    it('should prevent HOLNG user from accessing RIO PFA record', async () => {
      const response = await request(app)
        .get(`/api/pfa/records/${rioPfaRecord.id}`)
        .set('Authorization', `Bearer ${holngToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/access|permission|organization/i);
    });

    it('should prevent RIO user from accessing HOLNG PFA record', async () => {
      const response = await request(app)
        .get(`/api/pfa/records/${holngPfaRecord.id}`)
        .set('Authorization', `Bearer ${rioToken}`);

      expect(response.status).toBe(403);
    });

    it('should allow user to access their own org PFA record', async () => {
      const response = await request(app)
        .get(`/api/pfa/records/${holngPfaRecord.id}`)
        .set('Authorization', `Bearer ${holngToken}`);

      expect(response.status).toBe(200);
      expect(response.body.organizationId).toBe(holngOrg.id);
    });
  });

  describe('ATTACK-IDOR-002: Organization ID Query Manipulation', () => {
    it('should filter out unauthorized org records in list query', async () => {
      const response = await request(app)
        .get(`/api/pfa/records?organizationId=${rioOrg.id}`)
        .set('Authorization', `Bearer ${holngToken}`);

      // Either 403 OR empty result (data filtered)
      if (response.status === 200) {
        expect(response.body.length).toBe(0); // No RIO records visible
      } else {
        expect(response.status).toBe(403);
        expect(response.body.error).toMatch(/access|permission/i);
      }
    });

    it('should only return records from allowed organizations', async () => {
      const response = await request(app)
        .get('/api/pfa/records')
        .set('Authorization', `Bearer ${holngToken}`);

      expect(response.status).toBe(200);
      expect(response.body.every((r: any) => r.organizationId === holngOrg.id)).toBe(true);
    });
  });

  describe('ATTACK-IDOR-003: API Server Direct Modification', () => {
    it('should prevent HOLNG user from editing RIO API server', async () => {
      const response = await request(app)
        .patch(`/api/api-servers/${rioApiServer.id}`)
        .set('Authorization', `Bearer ${holngToken}`)
        .send({ name: 'Hacked Server' });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/permission|organization/i);

      // Verify server name unchanged
      const server = await prisma.apiServer.findUnique({ where: { id: rioApiServer.id } });
      expect(server.name).toBe('RIO Server');
    });

    it('should prevent RIO user from deleting HOLNG API server', async () => {
      const response = await request(app)
        .delete(`/api/api-servers/${holngApiServer.id}`)
        .set('Authorization', `Bearer ${rioToken}`);

      expect(response.status).toBe(403);

      // Verify server still exists
      const server = await prisma.apiServer.findUnique({ where: { id: holngApiServer.id } });
      expect(server).not.toBeNull();
    });

    it('should allow user to edit their own org API server', async () => {
      const response = await request(app)
        .patch(`/api/api-servers/${holngApiServer.id}`)
        .set('Authorization', `Bearer ${holngToken}`)
        .send({ name: 'Updated HOLNG Server' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated HOLNG Server');
    });
  });

  describe('ATTACK-IDOR-004: Context Switching Exploit', () => {
    it('should prevent user from switching to unauthorized organization', async () => {
      const response = await request(app)
        .post('/api/users/switch-context')
        .set('Authorization', `Bearer ${holngToken}`)
        .send({ organizationId: rioOrg.id });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/not authorized|access denied/i);

      // Verify user context unchanged
      const user = await prisma.user.findUnique({ where: { id: holngUser.id } });
      expect(user.organizationId).toBe(holngOrg.id);
    });

    it('should allow multi-org user to switch between allowed organizations', async () => {
      // Switch from HOLNG to RIO
      let response = await request(app)
        .post('/api/users/switch-context')
        .set('Authorization', `Bearer ${multiOrgToken}`)
        .send({ organizationId: rioOrg.id });

      expect(response.status).toBe(200);

      // Verify context switched
      const user = await prisma.user.findUnique({ where: { id: multiOrgUser.id } });
      expect(user.organizationId).toBe(rioOrg.id);

      // Switch back to HOLNG
      response = await request(app)
        .post('/api/users/switch-context')
        .set('Authorization', `Bearer ${multiOrgToken}`)
        .send({ organizationId: holngOrg.id });

      expect(response.status).toBe(200);
    });

    it('should prevent multi-org user from switching to non-allowed org', async () => {
      const response = await request(app)
        .post('/api/users/switch-context')
        .set('Authorization', `Bearer ${multiOrgToken}`)
        .send({ organizationId: bechOrg.id }); // Not in allowedOrganizationIds

      expect(response.status).toBe(403);
    });
  });

  describe('ATTACK-IDOR-005: Bulk Operation Cross-Org Injection', () => {
    it('should reject bulk update with records from unauthorized org', async () => {
      const response = await request(app)
        .post('/api/pfa/records/bulk-update')
        .set('Authorization', `Bearer ${holngToken}`)
        .send({
          recordIds: [holngPfaRecord.id, rioPfaRecord.id], // Injected RIO record
          updates: { category: 'Hacked' }
        });

      // Either 403 (entire operation rejected) OR 200 (but RIO record ignored)
      if (response.status === 200) {
        const rioRecord = await prisma.pfaRecord.findUnique({ where: { id: rioPfaRecord.id } });
        expect(rioRecord.category).not.toBe('Hacked'); // RIO record unchanged
      } else {
        expect(response.status).toBe(403);
      }

      // HOLNG record should be updated (if partial success allowed)
      const holngRecord = await prisma.pfaRecord.findUnique({ where: { id: holngPfaRecord.id } });
      expect(holngRecord.category).toBe('Hacked'); // OR unchanged if all-or-nothing
    });

    it('should filter out unauthorized records in bulk delete', async () => {
      const response = await request(app)
        .post('/api/pfa/records/bulk-delete')
        .set('Authorization', `Bearer ${holngToken}`)
        .send({
          recordIds: [rioPfaRecord.id] // Attempt to delete RIO record
        });

      expect(response.status).toBe(403); // OR 200 with 0 deleted

      // Verify RIO record not deleted
      const rioRecord = await prisma.pfaRecord.findUnique({ where: { id: rioPfaRecord.id } });
      expect(rioRecord).not.toBeNull();
    });
  });

  describe('ATTACK-IDOR-006: Audit Log Data Leak', () => {
    it('should prevent user from viewing other org audit logs', async () => {
      // Create audit log entry for RIO
      await prisma.auditLog.create({
        data: {
          userId: rioUser.id,
          organizationId: rioOrg.id,
          action: 'pfa:update',
          resourceType: 'PfaRecord',
          resourceId: rioPfaRecord.id,
          metadata: {}
        }
      });

      const response = await request(app)
        .get(`/api/audit-logs?organizationId=${rioOrg.id}`)
        .set('Authorization', `Bearer ${holngToken}`);

      // Either 403 OR empty result
      if (response.status === 200) {
        expect(response.body.length).toBe(0); // No RIO logs visible
      } else {
        expect(response.status).toBe(403);
      }
    });

    it('should only show audit logs from user allowed organizations', async () => {
      const response = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${holngToken}`);

      expect(response.status).toBe(200);
      expect(response.body.every((log: any) => log.organizationId === holngOrg.id)).toBe(true);
    });
  });

  describe('ATTACK-IDOR-007: User Enumeration', () => {
    it('should prevent HOLNG user from viewing RIO user details', async () => {
      const response = await request(app)
        .get(`/api/users/${rioUser.id}`)
        .set('Authorization', `Bearer ${holngToken}`);

      // Should be 403 OR 404 (indistinguishable from non-existent user)
      expect([403, 404]).toContain(response.status);
    });

    it('should allow user to view users from their own organization', async () => {
      // Assuming holngUser can view other HOLNG users
      const holngUser2 = await createUser({
        username: 'holng-user-2',
        email: 'holng2@test.com',
        organizationId: holngOrg.id,
        allowedOrganizationIds: [holngOrg.id],
        role: 'Viewer'
      });

      const response = await request(app)
        .get(`/api/users/${holngUser2.id}`)
        .set('Authorization', `Bearer ${holngToken}`);

      expect(response.status).toBe(200);
      expect(response.body.organizationId).toBe(holngOrg.id);

      await prisma.user.delete({ where: { id: holngUser2.id } });
    });

    it('should filter user list to only allowed organizations', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${holngToken}`);

      expect(response.status).toBe(200);
      // All returned users should be from HOLNG or multi-org users who have HOLNG access
      expect(response.body.every((u: any) =>
        u.allowedOrganizationIds.includes(holngOrg.id)
      )).toBe(true);
    });
  });

  describe('ATTACK-IDOR-008: API Server List Leak', () => {
    it('should only show API servers from user allowed organizations', async () => {
      const response = await request(app)
        .get('/api/api-servers')
        .set('Authorization', `Bearer ${holngToken}`);

      expect(response.status).toBe(200);
      expect(response.body.every((s: any) => s.organizationId === holngOrg.id)).toBe(true);
    });

    it('should show API servers from all allowed orgs for multi-org user', async () => {
      const response = await request(app)
        .get('/api/api-servers')
        .set('Authorization', `Bearer ${multiOrgToken}`);

      expect(response.status).toBe(200);
      const orgIds = response.body.map((s: any) => s.organizationId);
      expect(orgIds).toContain(holngOrg.id);
      expect(orgIds).toContain(rioOrg.id);
      expect(orgIds).not.toContain(bechOrg.id); // User not in BECH
    });
  });

  describe('ATTACK-IDOR-009: Organization Detail Leak', () => {
    it('should prevent user from viewing unauthorized organization details', async () => {
      const response = await request(app)
        .get(`/api/organizations/${rioOrg.id}`)
        .set('Authorization', `Bearer ${holngToken}`);

      expect([403, 404]).toContain(response.status);
    });

    it('should allow user to view their own organization details', async () => {
      const response = await request(app)
        .get(`/api/organizations/${holngOrg.id}`)
        .set('Authorization', `Bearer ${holngToken}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe('HOLNG');
    });
  });
});
```

### 2. Security Findings Report

Create `docs/security/IDOR_MULTI_TENANT_AUDIT.md`:

```markdown
# IDOR and Multi-Tenant Isolation Audit Report

**Audit Date**: [Current Date]
**Auditor**: ai-security-red-teamer
**System**: PFA Vanguard Multi-Tenant Access Control
**Scope**: ADR-005 IDOR Attack Vectors

---

## Executive Summary

**Total Attack Vectors Tested**: 9 categories, 21 test scenarios
**Critical Vulnerabilities Found**: [To be filled]
**Data Leak Vulnerabilities**: [To be filled]
**Overall Isolation Rating**: [To be determined]

---

## Attack Vector Analysis

### 1. Direct PFA Record Access (ATTACK-IDOR-001)
**Status**: [PASS/FAIL]
**Risk Level**: CRITICAL
**Test Results**:
- HOLNG → RIO record access: [Result]
- RIO → HOLNG record access: [Result]

**Findings**:
[Document if unauthorized access possible]

**Remediation** (if needed):
- Add organization ownership check in `getPfaRecordById` controller
- Verify `req.user.allowedOrganizationIds.includes(record.organizationId)`

---

### 2. Organization ID Query Manipulation (ATTACK-IDOR-002)
**Status**: [PASS/FAIL]
**Risk Level**: HIGH
**Test Results**:
- Query param manipulation: [Result]
- List query filtering: [Result]

**Findings**:
[Document if data leak possible via query manipulation]

**Remediation** (if needed):
- Implement server-side filtering: `WHERE organizationId IN (user.allowedOrganizationIds)`
- Never trust client-provided `organizationId` query param

---

### 3. API Server Direct Modification (ATTACK-IDOR-003)
**Status**: [PASS/FAIL]
**Risk Level**: CRITICAL
**Test Results**:
- Cross-org edit: [Result]
- Cross-org delete: [Result]

**Findings**:
[Document if unauthorized API server modification possible]

**Remediation** (if needed):
- Add `requireApiServerPermission` middleware
- Verify `apiServer.organizationId IN user.allowedOrganizationIds`

---

### 4. Context Switching Exploit (ATTACK-IDOR-004)
**Status**: [PASS/FAIL]
**Risk Level**: HIGH
**Test Results**:
- Unauthorized context switch: [Result]
- Multi-org valid switch: [Result]

**Findings**:
[Document if context switching allows unauthorized org access]

**Remediation** (if needed):
- Validate `newOrganizationId IN user.allowedOrganizationIds`
- Log all context switch attempts to audit log

---

### 5. Bulk Operation Cross-Org Injection (ATTACK-IDOR-005)
**Status**: [PASS/FAIL]
**Risk Level**: HIGH
**Test Results**:
- Bulk update with cross-org IDs: [Result]
- Bulk delete with cross-org IDs: [Result]

**Findings**:
[Document if bulk operations can affect other orgs data]

**Remediation** (if needed):
- Filter recordIds: `recordIds = recordIds.filter(id => ownedRecordIds.includes(id))`
- Return error if any unauthorized IDs detected

---

### 6. Audit Log Data Leak (ATTACK-IDOR-006)
**Status**: [PASS/FAIL]
**Risk Level**: MEDIUM
**Test Results**:
- Cross-org audit log access: [Result]
- Audit log filtering: [Result]

**Findings**:
[Document if audit logs leak data from other orgs]

**Remediation** (if needed):
- Always filter: `WHERE organizationId IN (user.allowedOrganizationIds)`
- Never expose audit logs without org filtering

---

### 7. User Enumeration (ATTACK-IDOR-007)
**Status**: [PASS/FAIL]
**Risk Level**: MEDIUM
**Test Results**:
- Cross-org user detail access: [Result]
- User list filtering: [Result]

**Findings**:
[Document if user enumeration possible]

**Remediation** (if needed):
- Return 404 (not 403) for non-existent OR unauthorized users
- Filter user list by shared organizations

---

### 8. API Server List Leak (ATTACK-IDOR-008)
**Status**: [PASS/FAIL]
**Risk Level**: MEDIUM
**Test Results**:
- API server list filtering: [Result]
- Multi-org server visibility: [Result]

**Findings**:
[Document if API servers leak across orgs]

**Remediation** (if needed):
- Filter: `WHERE organizationId IN (user.allowedOrganizationIds)`

---

### 9. Organization Detail Leak (ATTACK-IDOR-009)
**Status**: [PASS/FAIL]
**Risk Level**: LOW
**Test Results**:
- Cross-org detail access: [Result]

**Findings**:
[Document if organization details accessible without authorization]

**Remediation** (if needed):
- Verify `organizationId IN user.allowedOrganizationIds`

---

## Multi-Tenant Isolation Checklist

- [ ] All 21 test scenarios passing
- [ ] No critical IDOR vulnerabilities found
- [ ] PFA records properly isolated by organization
- [ ] API servers properly isolated by organization
- [ ] Audit logs properly isolated by organization
- [ ] User enumeration prevented or minimized
- [ ] Context switching validated against allowed organizations
- [ ] Bulk operations filtered to owned records only
- [ ] Database queries include organization filtering
- [ ] API responses never leak unauthorized org data

---

## Recommendations

### Immediate Actions (P0)
1. [List critical IDOR fixes needed]

### High Priority (P1)
1. [List high-priority isolation improvements]

---

## Appendix: Test Execution Log

[Paste test output]
```

### 3. Validation Script

Create `backend/scripts/validate-multi-tenant-isolation.ts`:

```typescript
/**
 * @file Validate Multi-Tenant Isolation
 * @description Script to verify organization data isolation in production database
 * @usage npx tsx scripts/validate-multi-tenant-isolation.ts
 */

import { prisma } from '../src/config/database';

async function validateIsolation() {
  console.log('🔍 Validating Multi-Tenant Isolation...\n');

  // Test 1: Verify all PFA records have organizationId
  const pfaWithoutOrg = await prisma.pfaRecord.count({
    where: { organizationId: null }
  });
  console.log(`✅ PFA Records without organizationId: ${pfaWithoutOrg}`);
  if (pfaWithoutOrg > 0) {
    console.error('❌ CRITICAL: Found PFA records without organization assignment');
  }

  // Test 2: Verify all API servers have organizationId
  const serversWithoutOrg = await prisma.apiServer.count({
    where: { organizationId: null }
  });
  console.log(`✅ API Servers without organizationId: ${serversWithoutOrg}`);

  // Test 3: Verify all users have allowedOrganizationIds
  const usersWithoutOrgs = await prisma.user.count({
    where: {
      OR: [
        { allowedOrganizationIds: { equals: [] } },
        { allowedOrganizationIds: null }
      ]
    }
  });
  console.log(`✅ Users without allowedOrganizationIds: ${usersWithoutOrgs}`);

  // Test 4: Check for orphaned UserOrganization records
  const orphanedRelations = await prisma.userOrganization.findMany({
    where: {
      OR: [
        { user: null },
        { organization: null }
      ]
    }
  });
  console.log(`✅ Orphaned UserOrganization records: ${orphanedRelations.length}`);

  // Test 5: Verify audit logs have organizationId
  const auditLogsWithoutOrg = await prisma.auditLog.count({
    where: { organizationId: null }
  });
  console.log(`✅ Audit logs without organizationId: ${auditLogsWithoutOrg}\n`);

  // Summary
  const issues = [
    pfaWithoutOrg,
    serversWithoutOrg,
    usersWithoutOrgs,
    orphanedRelations.length,
    auditLogsWithoutOrg
  ].reduce((sum, count) => sum + count, 0);

  if (issues === 0) {
    console.log('✅ All multi-tenant isolation checks passed!');
  } else {
    console.error(`❌ Found ${issues} isolation issues - review required`);
    process.exit(1);
  }
}

validateIsolation()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

## Success Criteria

✅ **Task Complete When**:
1. All 21 IDOR test scenarios implemented
2. All tests passing OR vulnerabilities documented
3. Security audit report generated
4. Validation script confirms database-level isolation
5. Remediation guide created for any findings

## Validation Steps

```bash
# Run IDOR tests
cd backend
npm run test:integration -- idorMultiTenant.test.ts

# Validate database isolation
npx tsx scripts/validate-multi-tenant-isolation.ts

# Check audit report
cat docs/security/IDOR_MULTI_TENANT_AUDIT.md | grep "Critical Vulnerabilities Found:"

# Verify coverage
npm run test:coverage -- idorMultiTenant.test.ts
```

## References

- **Test Plan**: ADR-005-TEST_PLAN.md lines 46-60 (Cross-Organization Access Tests)
- **Implementation**: ADR-005-IMPLEMENTATION_PLAN.md Phase 2 (Authorization Middleware)
- **UX Spec**: ADR-005-UX_SPEC.md (Multi-Org Context Switching)

---

**Estimated Time**: 3 hours
**Dependencies**: Phase 9 complete
**Blocker Risk**: NONE
**Agent Handoff**: → Task 10A.3 (Financial Masking Bypass Testing)
```

---

# Task 10A.3: Financial Masking Bypass Testing

**Agent**: ai-security-red-teamer
**Duration**: 3 hours
**Prerequisites**: Phase 9 Complete (Financial Masking UI implemented)
**Deliverables**:
- Financial masking bypass attack suite
- Client-side protection audit
- Security recommendations

---

## 📦 Self-Contained Prompt Bundle

```markdown
# TASK: Financial Masking Bypass Testing - ADR-005

## Your Role
You are the **ai-security-red-teamer** agent responsible for testing if users without `viewFinancialDetails` permission can bypass financial masking to see actual costs.

## Context: Financial Masking System

### Permission Model
**Permission**: `viewFinancialDetails` (boolean capability)
- `true`: User sees actual costs ($450,000)
- `false`: User sees masked costs (***masked*** + relative indicators)

**Affected Fields**:
- `PfaRecord.cost` (rental: monthlyRate × days, purchase: purchasePrice)
- `PfaRecord.monthlyRate`
- `PfaRecord.purchasePrice`
- Aggregated totals (Portfolio Variance Dashboard)

**Masking Implementation**:
- **Backend**: API responses replace cost fields with `"***masked***"` string
- **Frontend**: Components conditionally render based on `user.capabilities.viewFinancialDetails`
- **Relative Indicators**: Users see "HIGH impact" instead of "$450K"

### Attack Surface

**Critical Bypass Vectors**:
1. **Browser DevTools Inspection**: User inspects DOM/Network tab to find actual values
2. **API Response Manipulation**: User intercepts responses and un-masks values
3. **JavaScript Console Access**: User queries React state for un-masked data
4. **Query Parameter Injection**: User adds `?includeFinancials=true` to API calls
5. **Client-Side Filtering Bypass**: User modifies frontend code to show hidden values
6. **Memory Dump**: User inspects browser memory for cost values
7. **Export Bypass**: User exports data to CSV and finds costs included

## Your Mission

**Primary Objective**: Test every bypass vector to ensure financial costs are never exposed to unauthorized users.

**Attack Scenarios to Test**:

### Scenario 1: Browser DevTools Network Tab Inspection
**Initial State**: User without `viewFinancialDetails` loads PFA records
**Attack**: User opens DevTools → Network tab → Inspects `/api/pfa/records` response JSON
**Expected Defense**: Response JSON contains `"cost": "***masked***"`, not actual values

### Scenario 2: Query Parameter Injection
**Initial State**: User requests PFA records normally
**Attack**: User modifies URL to `GET /api/pfa/records?includeFinancials=true`
**Expected Defense**: 403 Forbidden - "FINANCIAL_ACCESS_DENIED" OR parameter ignored

### Scenario 3: JavaScript Console State Inspection
**Initial State**: User loads React app with PFA data
**Attack**: User opens console and runs `window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers.get(1).findFiberByHostInstance(document.querySelector('.pfa-record')).memoizedProps.cost`
**Expected Defense**: Prop contains `"***masked***"`, not actual cost

### Scenario 4: API Direct Call Bypass
**Initial State**: User has valid JWT token
**Attack**: User uses `curl` to call API directly without frontend filtering
**Expected Defense**: Backend always masks if `user.capabilities.viewFinancialDetails === false`

### Scenario 5: Export to CSV Bypass
**Initial State**: User exports PFA records to CSV
**Attack**: User opens CSV file and checks cost column
**Expected Defense**: CSV contains `"***masked***"` for cost, monthlyRate, purchasePrice

### Scenario 6: React Props Drilling
**Initial State**: User inspects React component props
**Attack**: User uses React DevTools to inspect PFA record component props
**Expected Defense**: Props never contain un-masked cost values

### Scenario 7: Audit Log Metadata Leak
**Initial State**: User views audit logs
**Attack**: User checks audit log metadata for cost change history (e.g., "cost changed from $10K to $20K")
**Expected Defense**: Audit log metadata masks costs for unauthorized users

## Deliverables

### 1. Integration Test Suite

Create test file at `backend/tests/integration/financialMaskingBypass.test.ts`:

```typescript
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../../src/server';
import { prisma } from '../../src/config/database';
import { createUser, loginAs, createOrganization, createPfaRecord } from '../helpers/testHelpers';

describe('Security: Financial Masking Bypass Prevention', () => {
  let org: any;
  let userWithFinancials: any;
  let tokenWithFinancials: string;
  let userWithoutFinancials: any;
  let tokenWithoutFinancials: string;
  let expensiveRecord: any;

  beforeAll(async () => {
    org = await createOrganization({ code: 'TEST', name: 'Test Org' });

    userWithFinancials = await createUser({
      username: 'financial-user',
      email: 'financial@test.com',
      organizationId: org.id,
      allowedOrganizationIds: [org.id],
      role: 'BEO User',
      capabilities: { canViewOrgData: true, viewFinancialDetails: true }
    });
    tokenWithFinancials = await loginAs('financial-user', 'password');

    userWithoutFinancials = await createUser({
      username: 'no-financial-user',
      email: 'no-financial@test.com',
      organizationId: org.id,
      allowedOrganizationIds: [org.id],
      role: 'Field Engineer',
      capabilities: { canViewOrgData: true, viewFinancialDetails: false }
    });
    tokenWithoutFinancials = await loginAs('no-financial-user', 'password');

    expensiveRecord = await createPfaRecord({
      organizationId: org.id,
      category: 'Cranes',
      description: 'Crane - Mobile 200T',
      source: 'Rental',
      monthlyRate: 150000,
      forecastStart: new Date('2025-01-01'),
      forecastEnd: new Date('2025-03-31'), // 3 months = $450K
    });
  });

  afterAll(async () => {
    await prisma.pfaRecord.delete({ where: { id: expensiveRecord.id } });
    await prisma.user.deleteMany({ where: { email: { in: ['financial@test.com', 'no-financial@test.com'] } } });
    await prisma.organization.delete({ where: { id: org.id } });
  });

  describe('ATTACK-MASK-001: API Response Inspection', () => {
    it('should mask cost in API response for unauthorized user', async () => {
      const response = await request(app)
        .get(`/api/pfa/records/${expensiveRecord.id}`)
        .set('Authorization', `Bearer ${tokenWithoutFinancials}`);

      expect(response.status).toBe(200);
      expect(response.body.cost).toBe('***masked***');
      expect(response.body.monthlyRate).toBe('***masked***');
      expect(response.body).not.toHaveProperty('purchasePrice'); // Or also masked

      // Verify actual cost NOT in response (even as metadata)
      const jsonString = JSON.stringify(response.body);
      expect(jsonString).not.toContain('450000');
      expect(jsonString).not.toContain('150000');
    });

    it('should show actual cost in API response for authorized user', async () => {
      const response = await request(app)
        .get(`/api/pfa/records/${expensiveRecord.id}`)
        .set('Authorization', `Bearer ${tokenWithFinancials}`);

      expect(response.status).toBe(200);
      expect(response.body.cost).toBeGreaterThan(400000); // Actual cost ~$450K
      expect(response.body.monthlyRate).toBe(150000);
    });

    it('should mask costs in list API response', async () => {
      const response = await request(app)
        .get(`/api/pfa/records?organizationId=${org.id}`)
        .set('Authorization', `Bearer ${tokenWithoutFinancials}`);

      expect(response.status).toBe(200);
      const record = response.body.find((r: any) => r.id === expensiveRecord.id);
      expect(record.cost).toBe('***masked***');
    });
  });

  describe('ATTACK-MASK-002: Query Parameter Injection', () => {
    it('should reject includeFinancials query param for unauthorized user', async () => {
      const response = await request(app)
        .get(`/api/pfa/records?organizationId=${org.id}&includeFinancials=true`)
        .set('Authorization', `Bearer ${tokenWithoutFinancials}`);

      // Either 403 (parameter rejected) OR 200 (parameter ignored, costs still masked)
      if (response.status === 403) {
        expect(response.body.error).toContain('FINANCIAL_ACCESS_DENIED');
      } else {
        expect(response.status).toBe(200);
        const record = response.body.find((r: any) => r.id === expensiveRecord.id);
        expect(record.cost).toBe('***masked***');
      }
    });

    it('should log financial access bypass attempts', async () => {
      await request(app)
        .get(`/api/pfa/records?includeFinancials=true`)
        .set('Authorization', `Bearer ${tokenWithoutFinancials}`);

      // Verify audit log entry created
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          userId: userWithoutFinancials.id,
          action: 'financial_access_attempt',
        }
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog.metadata).toMatchObject({
        attemptedBypass: true,
        queryParams: expect.objectContaining({ includeFinancials: 'true' })
      });
    });
  });

  describe('ATTACK-MASK-003: Export Bypass', () => {
    it('should mask costs in CSV export for unauthorized user', async () => {
      const response = await request(app)
        .get(`/api/pfa/records/export?organizationId=${org.id}&format=csv`)
        .set('Authorization', `Bearer ${tokenWithoutFinancials}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');

      const csvContent = response.text;
      expect(csvContent).toContain('***masked***');
      expect(csvContent).not.toContain('450000');
      expect(csvContent).not.toContain('150000');
    });

    it('should include actual costs in CSV export for authorized user', async () => {
      const response = await request(app)
        .get(`/api/pfa/records/export?organizationId=${org.id}&format=csv`)
        .set('Authorization', `Bearer ${tokenWithFinancials}`);

      expect(response.status).toBe(200);
      const csvContent = response.text;
      expect(csvContent).toMatch(/450000|150000/); // Actual costs present
    });
  });

  describe('ATTACK-MASK-004: Aggregated Totals Bypass', () => {
    it('should mask portfolio variance for unauthorized user', async () => {
      const response = await request(app)
        .get(`/api/analytics/portfolio-variance?organizationId=${org.id}`)
        .set('Authorization', `Bearer ${tokenWithoutFinancials}`);

      expect(response.status).toBe(200);
      expect(response.body.totalCost).toBe('***masked***');
      expect(response.body.variance).toBe('***masked***');
      expect(response.body).toHaveProperty('impactLevel'); // Relative indicator present
    });

    it('should show actual portfolio variance for authorized user', async () => {
      const response = await request(app)
        .get(`/api/analytics/portfolio-variance?organizationId=${org.id}`)
        .set('Authorization', `Bearer ${tokenWithFinancials}`);

      expect(response.status).toBe(200);
      expect(typeof response.body.totalCost).toBe('number');
      expect(response.body.totalCost).toBeGreaterThan(0);
    });
  });

  describe('ATTACK-MASK-005: Audit Log Metadata Leak', () => {
    it('should mask costs in audit log metadata', async () => {
      // Create audit log with cost change
      await prisma.auditLog.create({
        data: {
          userId: userWithFinancials.id,
          organizationId: org.id,
          action: 'pfa:update',
          resourceType: 'PfaRecord',
          resourceId: expensiveRecord.id,
          metadata: {
            changes: {
              monthlyRate: { from: 150000, to: 175000 }
            }
          }
        }
      });

      // Unauthorized user fetches audit log
      const response = await request(app)
        .get(`/api/audit-logs?resourceId=${expensiveRecord.id}`)
        .set('Authorization', `Bearer ${tokenWithoutFinancials}`);

      expect(response.status).toBe(200);
      const logEntry = response.body[0];

      // Verify costs masked in metadata
      expect(logEntry.metadata.changes.monthlyRate.from).toBe('***masked***');
      expect(logEntry.metadata.changes.monthlyRate.to).toBe('***masked***');
    });
  });

  describe('ATTACK-MASK-006: Relative Indicator Reverse Engineering', () => {
    it('should provide relative indicators without revealing exact costs', async () => {
      const response = await request(app)
        .get(`/api/pfa/records/${expensiveRecord.id}`)
        .set('Authorization', `Bearer ${tokenWithoutFinancials}`);

      expect(response.status).toBe(200);
      expect(response.body.cost).toBe('***masked***');

      // Relative indicators should be present
      expect(response.body.impactLevel).toMatch(/HIGH|MEDIUM|LOW/);
      expect(response.body.relativeComparison).toBeTruthy(); // E.g., "3.2x category average"

      // But should NOT reveal exact cost even indirectly
      // E.g., avoid saying "$450K is 3.2x $140K average" (can reverse engineer)
      const indicator = response.body.relativeComparison;
      expect(indicator).not.toMatch(/\$\d+/); // No dollar amounts in indicator
    });
  });

  describe('ATTACK-MASK-007: Token Manipulation', () => {
    it('should re-check permission on every request, not trust token claim', async () => {
      // Scenario: User had viewFinancialDetails, admin revokes it, but token still valid

      // Step 1: User loads data (has permission initially)
      let response = await request(app)
        .get(`/api/pfa/records/${expensiveRecord.id}`)
        .set('Authorization', `Bearer ${tokenWithFinancials}`);
      expect(response.body.cost).toBeGreaterThan(400000);

      // Step 2: Admin revokes viewFinancialDetails
      await prisma.user.update({
        where: { id: userWithFinancials.id },
        data: {
          capabilities: {
            canViewOrgData: true,
            viewFinancialDetails: false // Revoked
          }
        }
      });

      // Step 3: User makes another request with SAME token
      response = await request(app)
        .get(`/api/pfa/records/${expensiveRecord.id}`)
        .set('Authorization', `Bearer ${tokenWithFinancials}`);

      // Should be masked (if backend re-checks DB) OR still un-masked (if using cached token)
      // Acceptable: Cost visible until token expires (if TTL < 1 hour)
      if (response.body.cost === '***masked***') {
        console.log('✅ Permission re-checked on every request');
      } else {
        console.warn('⚠️ WARNING: Permissions cached in JWT - revocation not immediate');
        console.warn('   Verify token TTL < 1 hour for production');
      }

      // Step 4: After new login, should definitely be masked
      const newToken = await loginAs('financial-user', 'password');
      response = await request(app)
        .get(`/api/pfa/records/${expensiveRecord.id}`)
        .set('Authorization', `Bearer ${newToken}`);
      expect(response.body.cost).toBe('***masked***');
    });
  });
});
```

### 2. Client-Side Protection Audit

Create `docs/security/FINANCIAL_MASKING_AUDIT.md`:

```markdown
# Financial Masking Security Audit Report

**Audit Date**: [Current Date]
**Auditor**: ai-security-red-teamer
**System**: PFA Vanguard Financial Masking
**Scope**: ADR-005 Financial Data Protection

---

## Executive Summary

**Total Attack Vectors Tested**: 7 categories, 15 test scenarios
**Critical Leaks Found**: [To be filled]
**Client-Side Vulnerabilities**: [To be filled]
**Overall Masking Effectiveness**: [To be determined]

---

## Attack Vector Analysis

### 1. API Response Inspection (ATTACK-MASK-001)
**Status**: [PASS/FAIL]
**Risk Level**: CRITICAL
**Test Results**:
- Single record API: [Result]
- List API: [Result]
- Aggregated totals: [Result]

**Findings**:
[Document if costs visible in API responses]

**Remediation** (if needed):
- Ensure backend masks BEFORE sending response
- Never include actual costs in metadata or nested fields

---

### 2. Query Parameter Injection (ATTACK-MASK-002)
**Status**: [PASS/FAIL]
**Risk Level**: HIGH
**Test Results**:
- includeFinancials=true: [Result]
- Audit logging: [Result]

**Findings**:
[Document if query params bypass masking]

**Remediation** (if needed):
- Reject OR ignore `includeFinancials` param for unauthorized users
- Log all bypass attempts

---

### 3. Export Bypass (ATTACK-MASK-003)
**Status**: [PASS/FAIL]
**Risk Level**: HIGH
**Test Results**:
- CSV export masking: [Result]
- Excel export masking: [Result]

**Findings**:
[Document if exports leak costs]

**Remediation** (if needed):
- Apply same masking logic to exports
- Verify exports use server-side masking, not client-side

---

### 4. Aggregated Totals Bypass (ATTACK-MASK-004)
**Status**: [PASS/FAIL]
**Risk Level**: MEDIUM
**Test Results**:
- Portfolio variance: [Result]
- Category rollups: [Result]

**Findings**:
[Document if aggregations reveal individual costs]

**Remediation** (if needed):
- Mask aggregated totals as well as individual costs

---

### 5. Audit Log Metadata Leak (ATTACK-MASK-005)
**Status**: [PASS/FAIL]
**Risk Level**: MEDIUM
**Test Results**:
- Cost change history: [Result]

**Findings**:
[Document if audit logs leak historical costs]

**Remediation** (if needed):
- Mask costs in audit log metadata before storing
- OR mask when retrieving audit logs for unauthorized users

---

### 6. Relative Indicator Reverse Engineering (ATTACK-MASK-006)
**Status**: [PASS/FAIL]
**Risk Level**: LOW
**Test Results**:
- Indicator precision: [Result]

**Findings**:
[Document if relative indicators indirectly reveal exact costs]

**Remediation** (if needed):
- Avoid revealing category averages that allow reverse engineering
- Use imprecise indicators: "HIGH impact" instead of "3.2x $140K average"

---

### 7. Token Manipulation (ATTACK-MASK-007)
**Status**: [PASS/FAIL]
**Risk Level**: MEDIUM
**Test Results**:
- Permission revocation timing: [Result]

**Findings**:
[Document delay between permission revocation and masking]

**Remediation** (if needed):
- Re-check permissions on every request OR reduce token TTL to <1 hour

---

## Financial Masking Checklist

- [ ] All 15 test scenarios passing
- [ ] No critical cost leaks found
- [ ] API responses mask costs for unauthorized users
- [ ] Exports (CSV/Excel) mask costs
- [ ] Aggregated totals masked
- [ ] Audit log metadata masked
- [ ] Relative indicators don't reveal exact costs
- [ ] Bypass attempts logged to audit log
- [ ] Permission re-check on every request OR token TTL <1 hour

---

## Recommendations

### Immediate Actions (P0)
1. [List critical fixes]

### High Priority (P1)
1. Reduce JWT token TTL to 15 minutes for financial permissions
2. Implement token revocation list for immediate permission changes
3. Add rate limiting for export endpoints (prevent bulk data extraction)

### Medium Priority (P2)
1. Add watermarking to relative indicators to detect screenshot leaks
2. Implement data loss prevention (DLP) monitoring for financial exports

---

## Appendix: Test Execution Log

[Paste test output]
```

### 3. Frontend Protection Checklist

Create `docs/security/FINANCIAL_MASKING_FRONTEND.md`:

```markdown
# Frontend Financial Masking Checklist

## Critical Security Rules

### Rule 1: Never Send Unmasked Data to Frontend
❌ **WRONG**:
```typescript
// Backend sends unmasked data, frontend decides what to show
res.json({
  cost: 450000,
  userCanView: false
});
```

✅ **CORRECT**:
```typescript
// Backend masks BEFORE sending
const cost = user.capabilities.viewFinancialDetails ? 450000 : '***masked***';
res.json({ cost });
```

### Rule 2: No Client-Side Masking Logic
❌ **WRONG**:
```tsx
// Frontend masking (can be bypassed)
{user.canViewFinancials ? cost : '***masked***'}
```

✅ **CORRECT**:
```tsx
// Data already masked by backend
{cost}
```

### Rule 3: No Costs in Component Props
❌ **WRONG**:
```tsx
<PfaCard
  actualCost={450000}
  maskCost={!user.canViewFinancials}
/>
```

✅ **CORRECT**:
```tsx
<PfaCard cost={cost} /> // cost is already '***masked***' or actual value
```

### Rule 4: Validate Exports Server-Side
❌ **WRONG**:
```typescript
// Client generates CSV from local state
const csv = generateCsv(pfaRecords); // Might include unmasked costs
```

✅ **CORRECT**:
```typescript
// Server generates CSV with masking applied
const response = await fetch('/api/pfa/records/export?format=csv');
```

---

## Implementation Checklist

- [ ] Backend masking middleware applied to all financial endpoints
- [ ] Frontend never receives unmasked costs for unauthorized users
- [ ] Exports generated server-side with masking
- [ ] React DevTools inspection shows masked values in props
- [ ] Network tab inspection shows masked values in responses
- [ ] Local storage/session storage never contains unmasked costs
- [ ] Audit log metadata masked before storage
```

## Success Criteria

✅ **Task Complete When**:
1. All 15 financial masking bypass tests implemented
2. All tests passing OR leaks documented in audit report
3. Client-side protection audit completed
4. Remediation guide created for any vulnerabilities
5. Frontend protection checklist validated

## Validation Steps

```bash
# Run financial masking tests
cd backend
npm run test:integration -- financialMaskingBypass.test.ts

# Verify no cost leaks in API responses
npm run test:security -- financialMaskingBypass.test.ts --verbose

# Manual verification
# 1. Login as user without viewFinancialDetails
# 2. Open DevTools Network tab
# 3. Load PFA records
# 4. Verify all cost fields show "***masked***"

# Check audit report
cat docs/security/FINANCIAL_MASKING_AUDIT.md | grep "Critical Leaks Found:"
```

## References

- **Test Plan**: ADR-005-TEST_PLAN.md lines 1269-1320 (Financial Masking Tests)
- **UX Spec**: ADR-005-UX_SPEC.md Use Case 17 (Financial Masking)
- **AI Opportunities**: ADR-005-AI_OPPORTUNITIES.md Use Case 17

---

**Estimated Time**: 3 hours
**Dependencies**: Phase 9 complete (Financial masking UI implemented)
**Blocker Risk**: NONE
**Agent Handoff**: → Task 10A.4 (API Server Security Audit)
```

---

# Task 10A.4: API Server Security Audit

**Agent**: ai-security-red-teamer
**Duration**: 3 hours
**Prerequisites**: Phase 9 Complete (API Server Management implemented)
**Deliverables**:
- API server authorization test suite
- Cascading security validation
- External entity protection audit

---

## 📦 Self-Contained Prompt Bundle

```markdown
# TASK: API Server Security Audit - ADR-005

## Your Role
You are the **ai-security-red-teamer** agent responsible for adversarial testing of the API Server Management system. Your mission is to identify authorization bypasses, cascading security issues, and external entity protection vulnerabilities.

## Context: API Server Management Architecture

### Permission Model
**API Server CRUD** requires `perm_ManageSettings` permission:
- **Create**: User must have `perm_ManageSettings` + belong to target organization
- **Read**: User can view servers for their allowed organizations
- **Update**: User must have `perm_ManageSettings` + own the server's organization
- **Delete**: User must have `perm_ManageSettings` + own the server's organization

**Organization Status Cascading**:
- `Organization.serviceStatus = 'suspended'` → API server connections disabled
- `Organization.serviceStatus = 'active'` → API server connections enabled
- Suspension affects existing servers, but servers remain in database

**External Entity Protection**:
- `Organization.isExternal = true` → PEMS-managed, CANNOT be deleted
- `Organization.isExternal = false` → Local, CAN be deleted
- External orgs CAN have API servers (settings writable)
- API servers preserved during org unlinking

### Database Schema
```prisma
model Organization {
  id            String      @id
  code          String      @unique
  serviceStatus String      @default("active") // active, suspended
  isExternal    Boolean     @default(false)
  externalId    String?
  apiServers    ApiServer[]
}

model ApiServer {
  id             String
  organizationId String
  name           String
  baseUrl        String
  authType       String
  organization   Organization @relation(..., onDelete: Cascade)
  endpoints      ApiEndpoint[]
}

model ApiEndpoint {
  id       String
  serverId String
  name     String
  server   ApiServer @relation(..., onDelete: Cascade)
}
```

### Attack Surface

**Critical Security Vulnerabilities to Test**:
1. **Permission Bypass**: User without `perm_ManageSettings` creates/edits API servers
2. **Cross-Org Access**: User manages API servers for unauthorized organizations
3. **Cascading Delete**: Organization deletion fails to cascade to API servers
4. **Suspended Org Bypass**: API server test succeeds despite org suspension
5. **External Org Protection**: PEMS-managed org can be deleted
6. **Credentials Exposure**: API server credentials visible in responses

## Your Mission

**Primary Objective**: Test every attack vector that could compromise API server security.

**Attack Scenarios to Test**:

### Scenario 1: Create API Server Without Permission
**Initial State**: User has `perm_ManageSettings: false`
**Attack**: `POST /api/api-servers` with valid server data
**Expected Defense**: 403 Forbidden - "Requires perm_ManageSettings permission"

### Scenario 2: Edit API Server in Different Org
**Initial State**: User has `perm_ManageSettings` for RIO, tries to edit HOLNG server
**Attack**: `PATCH /api/api-servers/{holng-server-id}`
**Expected Defense**: 403 Forbidden - "You don't have permission to manage this organization's API servers"

### Scenario 3: Suspended Org API Server Test
**Initial State**: Organization is suspended
**Attack**: `POST /api/api-servers/{server-id}/test`
**Expected Defense**: 403 Forbidden - "Cannot test - Organization is suspended"

### Scenario 4: Delete External Org with API Servers
**Initial State**: PEMS-managed org has 5 API servers
**Attack**: `DELETE /api/organizations/{pems-org-id}`
**Expected Defense**: 403 Forbidden - "Cannot delete PEMS-managed organization"

### Scenario 5: Credentials Exposure
**Initial State**: User fetches API server details
**Attack**: `GET /api/api-servers/{server-id}`
**Expected Defense**: Response masks `apiKey`, `password`, `bearerToken` fields

### Scenario 6: Cascading Delete Validation
**Initial State**: Local org has 3 API servers, each with 5 endpoints
**Attack**: `DELETE /api/organizations/{local-org-id}`
**Expected Defense**: Organization + API servers + endpoints all deleted (onDelete: Cascade)

### Scenario 7: Reactivate Org Restores Servers
**Initial State**: Suspended org with API servers
**Attack**: `PATCH /api/organizations/{org-id}` with `{ serviceStatus: 'active' }`
**Expected Defense**: API server test now succeeds

## Deliverables

### 1. Integration Test Suite

Create test file at `backend/tests/integration/apiServerAuthorization.test.ts`:

```typescript
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../../src/server';
import { prisma } from '../../src/config/database';
import { createUser, loginAs, createOrganization, createApiServer } from '../helpers/testHelpers';

describe('Security: API Server Management Authorization', () => {
  let holngOrg: any;
  let rioOrg: any;
  let pemsOrg: any;
  let localOrg: any;

  let adminToken: string;
  let userWithPermToken: string;
  let userWithPermUser: any;
  let userWithoutPermToken: string;
  let userWithoutPermUser: any;

  let holngServer: any;
  let rioServer: any;

  beforeAll(async () => {
    // Create organizations
    holngOrg = await createOrganization({ code: 'HOLNG', name: 'Holcim Nigeria', serviceStatus: 'active' });
    rioOrg = await createOrganization({ code: 'RIO', name: 'Rio Tinto', serviceStatus: 'active' });
    pemsOrg = await createOrganization({
      code: 'PEMS_Global',
      name: 'PEMS Global',
      isExternal: true,
      externalId: 'PEMS-ORG-123',
      serviceStatus: 'active'
    });
    localOrg = await createOrganization({ code: 'LOCAL', name: 'Local Org', isExternal: false });

    // Create users
    adminToken = await loginAs('admin', 'admin123');

    userWithPermUser = await createUser({
      username: 'with-perm',
      email: 'with-perm@test.com',
      organizationId: holngOrg.id,
      allowedOrganizationIds: [holngOrg.id],
      role: 'Field Engineer',
      capabilities: { canViewOrgData: true, perm_ManageSettings: true }
    });
    userWithPermToken = await loginAs('with-perm', 'password');

    userWithoutPermUser = await createUser({
      username: 'without-perm',
      email: 'without-perm@test.com',
      organizationId: holngOrg.id,
      allowedOrganizationIds: [holngOrg.id],
      role: 'Field Engineer',
      capabilities: { canViewOrgData: true, perm_ManageSettings: false }
    });
    userWithoutPermToken = await loginAs('without-perm', 'password');

    // Create API servers
    holngServer = await createApiServer({
      organizationId: holngOrg.id,
      name: 'HOLNG Server',
      baseUrl: 'https://api.holng.com',
      authType: 'bearer',
      credentials: { bearerToken: 'secret-token-123' }
    });

    rioServer = await createApiServer({
      organizationId: rioOrg.id,
      name: 'RIO Server',
      baseUrl: 'https://api.rio.com',
      authType: 'basic',
      credentials: { username: 'admin', password: 'secret-pass' }
    });
  });

  afterAll(async () => {
    await prisma.apiServer.deleteMany({ where: { id: { in: [holngServer.id, rioServer.id] } } });
    await prisma.user.deleteMany({ where: { email: { in: ['with-perm@test.com', 'without-perm@test.com'] } } });
    await prisma.organization.deleteMany({ where: { code: { in: ['HOLNG', 'RIO', 'PEMS_Global', 'LOCAL'] } } });
  });

  describe('ATTACK-API-001: Create API Server Without Permission', () => {
    it('should prevent user without perm_ManageSettings from creating server', async () => {
      const response = await request(app)
        .post('/api/api-servers')
        .set('Authorization', `Bearer ${userWithoutPermToken}`)
        .send({
          organizationId: holngOrg.id,
          name: 'Unauthorized Server',
          baseUrl: 'https://evil.com',
          authType: 'bearer'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('perm_ManageSettings');
    });

    it('should allow user with perm_ManageSettings to create server', async () => {
      const response = await request(app)
        .post('/api/api-servers')
        .set('Authorization', `Bearer ${userWithPermToken}`)
        .send({
          organizationId: holngOrg.id,
          name: 'Authorized Server',
          baseUrl: 'https://api.authorized.com',
          authType: 'bearer'
        });

      expect(response.status).toBe(201);
      expect(response.body.organizationId).toBe(holngOrg.id);
      expect(response.body.name).toBe('Authorized Server');

      // Cleanup
      await prisma.apiServer.delete({ where: { id: response.body.id } });
    });
  });

  describe('ATTACK-API-002: Cross-Organization Access', () => {
    it('should prevent user from editing server in different org', async () => {
      const response = await request(app)
        .patch(`/api/api-servers/${rioServer.id}`)
        .set('Authorization', `Bearer ${userWithPermToken}`) // HOLNG user
        .send({ name: 'Hacked RIO Server' });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/organization|permission/i);

      // Verify server name unchanged
      const server = await prisma.apiServer.findUnique({ where: { id: rioServer.id } });
      expect(server.name).toBe('RIO Server');
    });

    it('should prevent user from deleting server in different org', async () => {
      const response = await request(app)
        .delete(`/api/api-servers/${rioServer.id}`)
        .set('Authorization', `Bearer ${userWithPermToken}`);

      expect(response.status).toBe(403);

      // Verify server still exists
      const server = await prisma.apiServer.findUnique({ where: { id: rioServer.id } });
      expect(server).not.toBeNull();
    });

    it('should allow user to edit server in their own org', async () => {
      const response = await request(app)
        .patch(`/api/api-servers/${holngServer.id}`)
        .set('Authorization', `Bearer ${userWithPermToken}`)
        .send({ name: 'Updated HOLNG Server' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated HOLNG Server');
    });
  });

  describe('ATTACK-API-003: Organization Suspension Cascading', () => {
    it('should prevent API server test when organization suspended', async () => {
      // Suspend organization
      await prisma.organization.update({
        where: { id: holngOrg.id },
        data: { serviceStatus: 'suspended' }
      });

      const response = await request(app)
        .post(`/api/api-servers/${holngServer.id}/test`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/suspended|cannot test/i);

      // Reactivate for other tests
      await prisma.organization.update({
        where: { id: holngOrg.id },
        data: { serviceStatus: 'active' }
      });
    });

    it('should allow API server test when organization active', async () => {
      const response = await request(app)
        .post(`/api/api-servers/${holngServer.id}/test`)
        .set('Authorization', `Bearer ${userWithPermToken}`);

      expect([200, 500]).toContain(response.status); // 200 if test succeeds, 500 if connection fails
      // As long as NOT 403, the authorization passed
    });

    it('should preserve API servers when organization suspended', async () => {
      // Suspend organization
      await prisma.organization.update({
        where: { id: holngOrg.id },
        data: { serviceStatus: 'suspended' }
      });

      // Verify servers still exist
      const servers = await prisma.apiServer.findMany({
        where: { organizationId: holngOrg.id }
      });
      expect(servers.length).toBeGreaterThan(0);

      // Reactivate
      await prisma.organization.update({
        where: { id: holngOrg.id },
        data: { serviceStatus: 'active' }
      });
    });
  });

  describe('ATTACK-API-004: External Organization Protection', () => {
    it('should prevent deletion of PEMS-managed organization', async () => {
      // Create API servers for PEMS org
      const pemsServers = await Promise.all([
        createApiServer({ organizationId: pemsOrg.id, name: 'PEMS Server 1' }),
        createApiServer({ organizationId: pemsOrg.id, name: 'PEMS Server 2' })
      ]);

      const response = await request(app)
        .delete(`/api/organizations/${pemsOrg.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Cannot delete PEMS-managed organization');
      expect(response.body.recommendation).toContain('Suspend or unlink instead');

      // Verify org still exists
      const org = await prisma.organization.findUnique({ where: { id: pemsOrg.id } });
      expect(org).not.toBeNull();

      // Cleanup
      await prisma.apiServer.deleteMany({ where: { id: { in: pemsServers.map(s => s.id) } } });
    });

    it('should allow deletion of local organization with cascading', async () => {
      // Create API servers + endpoints for local org
      const server1 = await createApiServer({ organizationId: localOrg.id, name: 'Local Server 1' });
      const server2 = await createApiServer({ organizationId: localOrg.id, name: 'Local Server 2' });

      await prisma.apiEndpoint.createMany({
        data: [
          { serverId: server1.id, name: 'Endpoint 1', method: 'GET', path: '/test1' },
          { serverId: server1.id, name: 'Endpoint 2', method: 'POST', path: '/test2' },
          { serverId: server2.id, name: 'Endpoint 3', method: 'GET', path: '/test3' }
        ]
      });

      const response = await request(app)
        .delete(`/api/organizations/${localOrg.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Verify cascading delete
      const org = await prisma.organization.findUnique({ where: { id: localOrg.id } });
      expect(org).toBeNull();

      const servers = await prisma.apiServer.findMany({ where: { organizationId: localOrg.id } });
      expect(servers.length).toBe(0);

      const endpoints = await prisma.apiEndpoint.findMany({
        where: { serverId: { in: [server1.id, server2.id] } }
      });
      expect(endpoints.length).toBe(0);
    });

    it('should preserve API servers when unlinking external org', async () => {
      // Create server for PEMS org
      const server = await createApiServer({ organizationId: pemsOrg.id, name: 'PEMS Test Server' });

      // Unlink organization (convert to local)
      const response = await request(app)
        .post(`/api/organizations/${pemsOrg.id}/unlink`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ confirmationToken: 'valid-token' });

      expect(response.status).toBe(200);

      // Verify org became local
      const org = await prisma.organization.findUnique({ where: { id: pemsOrg.id } });
      expect(org.isExternal).toBe(false);

      // Verify API server preserved
      const preservedServer = await prisma.apiServer.findUnique({ where: { id: server.id } });
      expect(preservedServer).not.toBeNull();

      // Cleanup
      await prisma.apiServer.delete({ where: { id: server.id } });

      // Restore external flag
      await prisma.organization.update({
        where: { id: pemsOrg.id },
        data: { isExternal: true }
      });
    });
  });

  describe('ATTACK-API-005: Credentials Exposure', () => {
    it('should mask sensitive credentials in API response', async () => {
      const response = await request(app)
        .get(`/api/api-servers/${holngServer.id}`)
        .set('Authorization', `Bearer ${userWithPermToken}`);

      expect(response.status).toBe(200);

      // Verify credentials masked
      if (response.body.credentials) {
        expect(response.body.credentials.bearerToken).toBe('***masked***');
        expect(response.body.credentials).not.toContain('secret-token-123');
      }

      // Or credentials field entirely omitted
      const jsonString = JSON.stringify(response.body);
      expect(jsonString).not.toContain('secret-token-123');
    });

    it('should mask credentials in list response', async () => {
      const response = await request(app)
        .get('/api/api-servers')
        .set('Authorization', `Bearer ${userWithPermToken}`);

      expect(response.status).toBe(200);
      const server = response.body.find((s: any) => s.id === holngServer.id);

      if (server.credentials) {
        expect(server.credentials.bearerToken).toBe('***masked***');
      }

      const jsonString = JSON.stringify(response.body);
      expect(jsonString).not.toContain('secret-token-123');
      expect(jsonString).not.toContain('secret-pass');
    });
  });

  describe('ATTACK-API-006: Permission Re-Check on Submit', () => {
    it('should re-check permission even if modal opened before revocation', async () => {
      // User loads edit modal (permission check passes)
      let response = await request(app)
        .get(`/api/api-servers/${holngServer.id}`)
        .set('Authorization', `Bearer ${userWithPermToken}`);
      expect(response.status).toBe(200);

      // Admin revokes perm_ManageSettings mid-session
      await prisma.user.update({
        where: { id: userWithPermUser.id },
        data: {
          capabilities: { canViewOrgData: true, perm_ManageSettings: false }
        }
      });

      // User submits edit form (permission re-checked)
      response = await request(app)
        .patch(`/api/api-servers/${holngServer.id}`)
        .set('Authorization', `Bearer ${userWithPermToken}`)
        .send({ name: 'Attempted Edit' });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('perm_ManageSettings');

      // Verify server name unchanged
      const server = await prisma.apiServer.findUnique({ where: { id: holngServer.id } });
      expect(server.name).toBe('Updated HOLNG Server'); // From earlier test

      // Restore permission
      await prisma.user.update({
        where: { id: userWithPermUser.id },
        data: {
          capabilities: { canViewOrgData: true, perm_ManageSettings: true }
        }
      });
    });
  });

  describe('ATTACK-API-007: Multi-Tenant Isolation', () => {
    it('should only show servers from user allowed organizations', async () => {
      const response = await request(app)
        .get('/api/api-servers')
        .set('Authorization', `Bearer ${userWithPermToken}`);

      expect(response.status).toBe(200);
      expect(response.body.every((s: any) => s.organizationId === holngOrg.id)).toBe(true);
      expect(response.body.every((s: any) => s.organizationId !== rioOrg.id)).toBe(true);
    });

    it('should update server list on org context switch', async () => {
      // Create multi-org user
      const multiOrgUser = await createUser({
        username: 'multi-org',
        email: 'multi-org@test.com',
        organizationId: holngOrg.id,
        allowedOrganizationIds: [holngOrg.id, rioOrg.id],
        role: 'Field Engineer',
        capabilities: { perm_ManageSettings: true }
      });
      const multiOrgToken = await loginAs('multi-org', 'password');

      // Get HOLNG servers
      let response = await request(app)
        .get(`/api/api-servers?organizationId=${holngOrg.id}`)
        .set('Authorization', `Bearer ${multiOrgToken}`);
      expect(response.body.every((s: any) => s.organizationId === holngOrg.id)).toBe(true);

      // Switch context to RIO
      await request(app)
        .post('/api/users/switch-context')
        .set('Authorization', `Bearer ${multiOrgToken}`)
        .send({ organizationId: rioOrg.id });

      // Get RIO servers
      response = await request(app)
        .get(`/api/api-servers?organizationId=${rioOrg.id}`)
        .set('Authorization', `Bearer ${multiOrgToken}`);
      expect(response.body.every((s: any) => s.organizationId === rioOrg.id)).toBe(true);

      // Cleanup
      await prisma.user.delete({ where: { id: multiOrgUser.id } });
    });
  });
});
```

### 2. Security Audit Report

Create `docs/security/API_SERVER_SECURITY_AUDIT.md`:

```markdown
# API Server Security Audit Report

**Audit Date**: [Current Date]
**Auditor**: ai-security-red-teamer
**System**: PFA Vanguard API Server Management
**Scope**: ADR-005 API Server Authorization & Protection

---

## Executive Summary

**Total Attack Vectors Tested**: 7 categories, 18 test scenarios
**Critical Vulnerabilities Found**: [To be filled]
**Authorization Bypasses**: [To be filled]
**Credentials Exposure**: [To be filled]
**Overall Security Rating**: [To be determined]

---

## Attack Vector Analysis

### 1. Permission Bypass (ATTACK-API-001)
**Status**: [PASS/FAIL]
**Risk Level**: CRITICAL
**Test Results**:
- Create without permission: [Result]
- Create with permission: [Result]

**Findings**:
[Document if unauthorized users can create API servers]

**Remediation** (if needed):
- Ensure `requirePermission('perm_ManageSettings')` guards all CRUD endpoints

---

### 2. Cross-Organization Access (ATTACK-API-002)
**Status**: [PASS/FAIL]
**Risk Level**: CRITICAL
**Test Results**:
- Cross-org edit: [Result]
- Cross-org delete: [Result]

**Findings**:
[Document if cross-org access possible]

**Remediation** (if needed):
- Add `requireApiServerPermission` middleware
- Verify `apiServer.organizationId IN user.allowedOrganizationIds`

---

### 3. Organization Suspension Cascading (ATTACK-API-003)
**Status**: [PASS/FAIL]
**Risk Level**: HIGH
**Test Results**:
- Suspended org test blocked: [Result]
- Active org test allowed: [Result]
- Servers preserved during suspension: [Result]

**Findings**:
[Document if suspended org servers remain functional]

**Remediation** (if needed):
- Check org status before test: `if (org.serviceStatus === 'suspended') throw 403`

---

### 4. External Organization Protection (ATTACK-API-004)
**Status**: [PASS/FAIL]
**Risk Level**: HIGH
**Test Results**:
- PEMS org delete blocked: [Result]
- Local org delete cascading: [Result]
- Servers preserved during unlink: [Result]

**Findings**:
[Document if PEMS orgs can be deleted]

**Remediation** (if needed):
- Prevent deletion: `if (org.isExternal) throw 403`
- Suggest suspend/unlink alternative

---

### 5. Credentials Exposure (ATTACK-API-005)
**Status**: [PASS/FAIL]
**Risk Level**: CRITICAL
**Test Results**:
- Single server credentials masked: [Result]
- List response credentials masked: [Result]

**Findings**:
[Document if credentials leaked in responses]

**Remediation** (if needed):
- Mask credentials before sending: `credentials.bearerToken = '***masked***'`
- OR omit credentials field entirely from GET responses

---

### 6. Permission Re-Check on Submit (ATTACK-API-006)
**Status**: [PASS/FAIL]
**Risk Level**: MEDIUM
**Test Results**:
- Revoked permission blocks submit: [Result]

**Findings**:
[Document delay between permission revocation and enforcement]

**Remediation** (if needed):
- Re-check permissions on every mutating request
- Reduce token TTL to <1 hour

---

### 7. Multi-Tenant Isolation (ATTACK-API-007)
**Status**: [PASS/FAIL]
**Risk Level**: HIGH
**Test Results**:
- Server list filtering: [Result]
- Context switch updates list: [Result]

**Findings**:
[Document if servers leak across organizations]

**Remediation** (if needed):
- Filter: `WHERE organizationId IN (user.allowedOrganizationIds)`

---

## API Server Security Checklist

- [ ] All 18 test scenarios passing
- [ ] No critical authorization bypasses found
- [ ] perm_ManageSettings required for all CRUD operations
- [ ] Cross-organization access prevented
- [ ] Suspended org connections disabled
- [ ] PEMS organizations cannot be deleted
- [ ] Cascading delete works for local organizations
- [ ] Credentials masked in all responses
- [ ] Permission re-checked on every request
- [ ] Multi-tenant isolation enforced

---

## Recommendations

### Immediate Actions (P0)
1. [List critical fixes]

### High Priority (P1)
1. [List high-priority improvements]

---

## Appendix: Test Execution Log

[Paste test output]
```

## Success Criteria

✅ **Task Complete When**:
1. All 18 API server security tests implemented
2. All tests passing OR vulnerabilities documented
3. Security audit report generated
4. Remediation guide created for any findings
5. Cascading security validated

## Validation Steps

```bash
# Run API server security tests
cd backend
npm run test:integration -- apiServerAuthorization.test.ts

# Verify permission enforcement
npm run test:security -- apiServerAuthorization.test.ts --verbose

# Manual verification
# 1. Login as user without perm_ManageSettings
# 2. Try to create API server
# 3. Verify 403 Forbidden response

# Check audit report
cat docs/security/API_SERVER_SECURITY_AUDIT.md | grep "Critical Vulnerabilities Found:"
```

## References

- **Test Plan**: ADR-005-TEST_PLAN.md lines 265-376 (API Server Authorization Tests)
- **Implementation**: ADR-005-IMPLEMENTATION_PLAN.md Phase 2 (Authorization Middleware)
- **UX Spec**: ADR-005-UX_SPEC.md Use Case 3 (API Connectivity)

---

**Estimated Time**: 3 hours
**Dependencies**: Phase 9 complete (API Server Management implemented)
**Blocker Risk**: NONE
**Agent Handoff**: → Task 10A.5 (JWT Tampering) OR Phase 10B (QA Testing)
```

---

## 🎯 Phase 10A Summary

**Total Duration**: 1.5 days (12 hours)
**Total Tasks**: 6 (4 in this file + 2 in PHASE_10_PROMPT_BUNDLES.md)
**Agent**: ai-security-red-teamer (all tasks)

**Critical Outputs**:
1. Privilege escalation test suite (18 scenarios)
2. IDOR/multi-tenant isolation tests (21 scenarios)
3. Financial masking bypass tests (15 scenarios)
4. API server authorization tests (18 scenarios)
5. JWT tampering tests (6 scenarios) - in PHASE_10_PROMPT_BUNDLES.md
6. Rate limiting tests (8 scenarios) - in PHASE_10_PROMPT_BUNDLES.md

**Total Test Coverage**: 86 security test scenarios

**Success Criteria for Phase 10A**:
- ✅ All 86 test scenarios implemented
- ✅ All tests passing OR vulnerabilities documented with remediation plans
- ✅ 4 security audit reports generated
- ✅ Automated regression test suite integrated into CI/CD
- ✅ Security compliance checklist completed
- ✅ No critical vulnerabilities found OR all critical vulnerabilities fixed

---

**Next Phase**: Phase 10B (QA Testing) - See PHASE_10_PROMPT_BUNDLES.md

**Document Created**: [Current Date]
**Last Updated**: [Current Date]
**Version**: 1.0

---

# Phase 10: Security & QA - Complete Prompt Bundles

**Purpose**: 8 concise, ready-to-use prompt bundles for remaining Phase 10 tasks.

**Generated**: 2025-11-27

---

## Bundle Index

**Phase 10A (Security)**:
1. [Task 10A.5: JWT Tampering Testing](#bundle-10a5-jwt-tampering-testing)
2. [Task 10A.6: Rate Limiting Bypass Testing](#bundle-10a6-rate-limiting-bypass-testing)

**Phase 10B (QA)**:
3. [Task 10B.1: Integration Test Suite](#bundle-10b1-integration-test-suite)
4. [Task 10B.2: E2E Permission Workflow Tests](#bundle-10b2-e2e-permission-workflow-tests)
5. [Task 10B.3: Load Testing](#bundle-10b3-load-testing)
6. [Task 10B.4: Performance Benchmarking](#bundle-10b4-performance-benchmarking)
7. [Task 10B.5: Accessibility Compliance Testing](#bundle-10b5-accessibility-compliance-testing)
8. [Task 10B.6: Documentation Review](#bundle-10b6-documentation-review)

---

# Bundle 10A.5: JWT Tampering Testing

**Agent**: @ai-security-red-teamer

## System Context

You are an adversarial security tester specializing in **authentication bypass** and **token manipulation attacks**. Your role is to simulate attackers attempting to exploit JWT implementation weaknesses in the Multi-Tenant Access Control system.

**What This System Does**:
- Uses JWT tokens for authentication (stored as `pfa_auth_token` in localStorage)
- Tokens contain userId, username, role, organizationIds, capabilities
- Backend validates tokens using `jsonwebtoken` library
- Token expiry: 7 days (configurable)
- Middleware `verifyToken()` checks signature and expiration

**Your Mission**: Find every possible way to bypass JWT authentication or escalate privileges through token manipulation.

## Business Context

**Attack Scenarios You'll Test**:

1. **Signature Tampering**: Modify token payload without valid signature → Should be rejected with 401
2. **Role Escalation**: Change `role: 'viewer'` to `role: 'admin'` in token → Should fail signature verification
3. **Organization Bypass**: Add unauthorized `organizationId` to `allowedOrganizationIds[]` → Should be rejected

**Real-World Impact**:
- **If successful**: Attacker gains admin access, steals data from unauthorized orgs, grants themselves permissions
- **If blocked**: Feature is production-ready for security-critical multi-tenant environment

## Technical Specification

**JWT Structure** (PFA Vanguard):
```typescript
// Token Payload
{
  userId: 'user-123',
  username: 'alice',
  role: 'editor',
  organizationId: 'HOLNG',  // Current active org
  allowedOrganizationIds: ['HOLNG', 'RIO'],
  capabilities: {
    perm_ManageUsers: false,
    perm_ManageSettings: true,
    // ... other capabilities
  },
  iat: 1700000000,  // Issued at
  exp: 1700604800   // Expires at (7 days later)
}
```

**Validation Flow**:
```typescript
// backend/src/middleware/auth.ts
export const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;  // Attach to request
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

**Test Cases** (from TEST_PLAN.md lines 63-77):

```typescript
describe('Security: JWT Token Integrity', () => {
  // Test 1: Signature Tampering
  it('should reject modified JWT tokens', async () => {
    const token = await loginAs('admin');
    const tamperedToken = token.replace('admin', 'super-admin');
    const response = await apiCall(tamperedToken);
    expect(response.status).toBe(401);
  });

  // Test 2: Expiration Bypass
  it('should reject expired tokens', async () => {
    const expiredToken = generateExpiredToken();
    const response = await apiCall(expiredToken);
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('TOKEN_EXPIRED');
  });

  // Test 3: None Algorithm Attack
  it('should reject tokens with "none" algorithm', async () => {
    const noneAlgToken = jwt.sign(payload, '', { algorithm: 'none' });
    const response = await apiCall(noneAlgToken);
    expect(response.status).toBe(401);
  });

  // Test 4: HS256 to RS256 Confusion
  it('should reject algorithm confusion attacks', async () => {
    const confusedToken = signWithWrongAlgorithm(payload);
    const response = await apiCall(confusedToken);
    expect(response.status).toBe(401);
  });

  // Test 5: Replay Attack
  it('should reject tokens after user logout', async () => {
    const token = await loginAs('alice');
    await logout(token);  // Invalidate session
    const response = await apiCall(token);
    expect(response.status).toBe(401);
  });
});
```

**Additional Attack Vectors**:

1. **Token Replay** (lines 78-90): Use valid token after user suspension/deletion
2. **Secret Brute Force**: Attempt to guess JWT_SECRET (simulate weak secret)
3. **Algorithm Confusion**: Change `alg` header from HS256 to RS256/none
4. **Payload Injection**: Inject SQL/XSS into username field, re-sign with guessed secret
5. **Time Manipulation**: Set `exp` 10 years in future, sign with guessed secret

**Expected Behavior**:
```typescript
// ✅ PASS: All attacks rejected with 401
{
  status: 401,
  body: {
    error: 'Invalid token' | 'TOKEN_EXPIRED' | 'TOKEN_MALFORMED'
  }
}

// ❌ FAIL: Attack succeeds
{
  status: 200,
  body: { /* authenticated response */ }
}
```

## Your Mission

**Execute these steps**:

1. **Setup Test Environment**:
   - Create test users with different roles (admin, editor, viewer)
   - Generate valid JWT tokens for each user
   - Set up automated test suite with `vitest` + `supertest`

2. **Signature Tampering Tests**:
   - Modify payload fields (role, organizationIds, capabilities)
   - Change signature bytes manually
   - Replace signature with empty string
   - Use signature from different token (token swapping)

3. **Algorithm Attacks**:
   - Change `alg` header to `none` (nullify signature verification)
   - Change HS256 to RS256 (algorithm confusion)
   - Use weak algorithms (MD5, SHA1 - if library allows)

4. **Expiration Bypass**:
   - Submit expired tokens (past `exp` timestamp)
   - Submit tokens with `exp` = 10 years in future (forged)
   - Remove `exp` field entirely

5. **Replay & Revocation**:
   - Use valid token after user logout
   - Use valid token after user suspension
   - Use valid token after user deletion
   - Use valid token after password change

6. **Secret Brute Force Simulation**:
   - Test common weak secrets (e.g., 'secret', '12345', 'jwt_secret')
   - Document recommended secret strength (minimum 256 bits)

7. **Document Results**:
   - Create `backend/tests/integration/jwtSecurity.test.ts`
   - Update TESTING_LOG.md with [TEST-JWT-001] entry
   - Add findings to TEST_PLAN.md (Security section)

## Deliverables

1. **Test Suite**: `backend/tests/integration/jwtSecurity.test.ts` (15+ test cases)
2. **Attack Report**: `docs/security/JWT_ATTACK_REPORT.md` with vulnerabilities found
3. **Remediation Plan**: If vulnerabilities found, provide fixes (e.g., stronger secret, algorithm whitelist)
4. **TESTING_LOG.md Update**: [TEST-JWT-001] status with execution results

## Constraints

**❌ DO NOT**:
- Use actual production tokens for testing
- Share JWT_SECRET values in test files (use .env.test)
- Submit test results to public repositories (security-sensitive)
- Test against production API endpoints

**✅ DO**:
- Use test database with isolated test users
- Generate tokens programmatically for each test
- Document every attack vector attempted (success or failure)
- Provide remediation recommendations for any vulnerabilities found

## Verification Questions

1. **Token Validation**: Can you modify a token payload and successfully authenticate? (Expected: NO)
2. **Expiration Enforcement**: Can you use a token with `exp` from 2 years ago? (Expected: NO)
3. **Algorithm Security**: Can you bypass signature verification using `alg: none`? (Expected: NO)
4. **Replay Prevention**: Can you use a valid token after user logout? (Expected: NO - if session invalidation implemented)
5. **Secret Strength**: If JWT_SECRET is 'password', can you forge tokens? (Expected: YES - document as vulnerability)

---

# Bundle 10A.6: Rate Limiting Bypass Testing

**Agent**: @ai-security-red-teamer

## System Context

You are an adversarial security tester specializing in **brute force attacks** and **rate limiting evasion**. Your role is to simulate attackers attempting to overwhelm authentication endpoints and bypass rate limits through distributed attacks.

**What This System Does**:
- Global rate limiting: 100 requests/15 minutes per IP (express-rate-limit)
- Account lockout: 5 failed login attempts → user suspended for 30 minutes
- Rate limit tracking: In-memory (development) or Redis (production)
- Endpoints protected: `/api/auth/login`, `/api/auth/register`

**Your Mission**: Find every way to bypass rate limits and test account lockout mechanisms.

## Business Context

**Attack Scenarios**:

1. **Credential Stuffing**: 1000+ login attempts/minute using stolen credentials → Should hit rate limit
2. **Account Enumeration**: Probe `/api/auth/login` to discover valid usernames → Rate limit + generic error messages
3. **Distributed Attack**: Rotate IP addresses to evade per-IP rate limits → Detect via behavioral analysis

**Real-World Impact**:
- **If vulnerable**: Attacker can brute force passwords, enumerate users, cause service downtime
- **If blocked**: Feature is production-ready for high-security environments

## Technical Specification

**Rate Limiting Implementation**:
```typescript
// backend/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});
```

**Account Lockout Logic** (TEST_PLAN.md lines 101-110):
```typescript
// backend/src/services/auth/authService.ts
async login(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user) {
    return { error: 'Invalid credentials' };  // Generic error
  }

  // Check lockout status
  if (user.serviceStatus === 'locked' && user.lockedUntil > new Date()) {
    return { error: 'Account locked. Try again later.' };
  }

  // Verify password
  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    // Increment failed attempts
    const failedAttempts = user.failedLoginAttempts + 1;

    if (failedAttempts >= 5) {
      // Lock account for 30 minutes
      await prisma.user.update({
        where: { id: user.id },
        data: {
          serviceStatus: 'locked',
          lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
          failedLoginAttempts: failedAttempts
        }
      });
      return { error: 'Account locked due to too many failed attempts' };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts }
    });

    return { error: 'Invalid credentials' };
  }

  // Successful login - reset failed attempts
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, serviceStatus: 'active' }
  });

  return { token: generateToken(user), user };
}
```

**Test Cases** (TEST_PLAN.md lines 89-110):

```typescript
describe('Security: Rate Limiting', () => {
  // Test 1: Global Rate Limit
  it('should rate limit failed login attempts', async () => {
    const attempts = Array(101).fill(null);  // 101 attempts
    const responses = [];

    for (const _ of attempts) {
      const res = await loginAs('admin', 'wrong-password');
      responses.push(res);
    }

    const rateLimited = responses.filter(r => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
    expect(rateLimited[0].body.error).toContain('Too many requests');
  });

  // Test 2: Account Lockout
  it('should lock account after 5 failed attempts', async () => {
    const user = await createUser({ username: 'bob' });

    // Attempt 5 failed logins
    for (let i = 0; i < 5; i++) {
      await loginAs('bob', 'wrong-password');
    }

    const userRecord = await getUser(user.id);
    expect(userRecord.serviceStatus).toBe('locked');
    expect(userRecord.lockedUntil).toBeInstanceOf(Date);
  });

  // Test 3: IP Rotation Evasion
  it('should detect distributed brute force attacks', async () => {
    // Simulate 1000 requests from 100 different IPs
    const ips = Array(100).fill(null).map((_, i) => `192.168.1.${i}`);
    const requests = [];

    for (let i = 0; i < 1000; i++) {
      const ip = ips[i % 100];
      requests.push(
        loginAs('admin', 'wrong-password', { headers: { 'X-Forwarded-For': ip } })
      );
    }

    const responses = await Promise.all(requests);

    // Should still trigger security alert (behavioral analysis)
    const alerts = await prisma.securityAlert.findMany({
      where: { type: 'DISTRIBUTED_BRUTE_FORCE' }
    });

    expect(alerts.length).toBeGreaterThan(0);
  });

  // Test 4: Lockout Duration
  it('should unlock account after 30 minutes', async () => {
    const user = await createUser({ username: 'charlie' });

    // Lock account
    for (let i = 0; i < 5; i++) {
      await loginAs('charlie', 'wrong-password');
    }

    // Fast-forward 30 minutes (mock Date.now)
    jest.useFakeTimers();
    jest.advanceTimersByTime(30 * 60 * 1000);

    // Should be unlocked
    const response = await loginAs('charlie', 'correct-password');
    expect(response.status).toBe(200);

    jest.useRealTimers();
  });
});
```

**Additional Attack Vectors**:

1. **Slowloris Attack**: Send partial requests to exhaust server connections
2. **User Enumeration**: Time-based attacks (username exists = 200ms, doesn't exist = 50ms)
3. **CAPTCHA Bypass**: If CAPTCHA exists, test for bypass techniques
4. **Session Fixation**: Force user to use attacker-controlled session ID

## Your Mission

**Execute these steps**:

1. **Setup Load Testing Environment**:
   - Install `artillery` or `k6` for load testing
   - Create test user accounts with known passwords
   - Set up test database with monitoring

2. **Brute Force Simulation**:
   - Generate 10,000 login attempts with random passwords
   - Measure at what point rate limit triggers (should be 100 requests)
   - Verify HTTP 429 response with appropriate headers

3. **Account Lockout Testing**:
   - Test 5 consecutive failed logins → user locked
   - Verify locked user cannot login even with correct password
   - Test lockout duration (30 minutes)
   - Verify failed attempt counter resets on successful login

4. **IP Rotation Bypass**:
   - Simulate distributed attack from 100+ IPs
   - Send 10 requests/IP (1000 total) within 5 minutes
   - Check if system detects attack pattern

5. **Response Time Analysis**:
   - Measure response time for valid vs invalid usernames
   - Document if timing leak reveals user existence

6. **Rate Limit Reset Testing**:
   - Hit rate limit → wait 15 minutes → verify limit resets
   - Test concurrent requests at limit boundary

7. **Document Results**:
   - Create `backend/tests/integration/rateLimitingSecurity.test.ts`
   - Update TESTING_LOG.md with [TEST-RL-001]
   - Create load test script: `scripts/load-test/brute-force-simulation.yml`

## Deliverables

1. **Test Suite**: `backend/tests/integration/rateLimitingSecurity.test.ts` (10+ test cases)
2. **Load Test Config**: `scripts/load-test/brute-force-simulation.yml` (Artillery or k6 script)
3. **Attack Report**: `docs/security/RATE_LIMITING_ATTACK_REPORT.md`
4. **TESTING_LOG.md Update**: [TEST-RL-001] status with performance metrics

## Constraints

**❌ DO NOT**:
- Run tests against production API
- Use real user credentials
- Exceed 10,000 requests/test (avoid actual DoS)
- Test during business hours (could affect shared dev environment)

**✅ DO**:
- Use isolated test environment
- Clean up test data after tests complete
- Monitor server resource usage (CPU, memory) during tests
- Document rate limit thresholds observed

## Verification Questions

1. **Rate Limit Enforcement**: After 100 requests, does the 101st return HTTP 429? (Expected: YES)
2. **Account Lockout**: After 5 failed logins, is the account locked? (Expected: YES)
3. **Lockout Duration**: Can user login after 30 minutes of lockout? (Expected: YES)
4. **IP Rotation Detection**: Can 1000 requests from 100 IPs bypass rate limit? (Expected: System detects pattern)
5. **Generic Errors**: Do error messages reveal if username exists? (Expected: NO - same error for all failures)
6. **Performance**: Does rate limiting add >50ms latency to requests? (Expected: NO)

---

# Bundle 10B.1: Integration Test Suite

**Agent**: @sdet-test-automation

## System Context

You are a Software Development Engineer in Test (SDET) specializing in **integration testing** for multi-tier applications. Your mission is to implement the **171+ test cases** defined in ADR-005-TEST_PLAN.md with **>80% code coverage** requirement.

**What This System Does**:
- Multi-tenant access control with RBAC (Role-Based Access Control)
- JWT authentication + permission middleware
- API Server Management (CRUD operations with org isolation)
- Organization status cascading (suspend org → disable API servers)
- External entity protection (PEMS-managed orgs/users cannot be deleted)

**Your Mission**: Create comprehensive integration tests covering all API endpoints, permission flows, and data integrity checks.

## Business Context

**Critical Scenarios**:

1. **Permission Grant Flow**: Admin grants `perm_ManageSettings` to user → User can create API server
2. **Organization Suspension**: Admin suspends org → All API servers in that org become unusable
3. **External Entity Protection**: Attempt to delete PEMS-managed organization → Blocked with 403 error

**Why This Matters**:
- **Security**: Ensure unauthorized users cannot escalate privileges or access other orgs' data
- **Data Integrity**: Verify cascading deletes don't orphan records
- **Multi-Tenancy**: Confirm organization isolation works (user in HOLNG cannot see RIO data)

## Technical Specification

**Test Plan Coverage** (ADR-005-TEST_PLAN.md):
- **Section 1**: Authentication & Authorization (lines 20-110)
- **Section 7**: API Server Management Authorization (lines 265-376)
- **Section 8**: Organization Status Cascading (lines 377-513)
- **Section 9**: API Server Multi-Tenant Isolation (lines 514-627)
- **Section 10**: External Organization Constraints (lines 628-728)

**Test Framework**:
```typescript
// backend/tests/integration/setup.ts
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import app from '../../src/server';

export const prisma = new PrismaClient();

export async function createTestUser(data: Partial<User>) {
  return prisma.user.create({
    data: {
      username: data.username || 'testuser',
      passwordHash: await bcrypt.hash(data.password || 'password', 10),
      role: data.role || 'viewer',
      organizationId: data.organizationId,
      allowedOrganizationIds: data.allowedOrganizationIds || [],
      capabilities: data.capabilities || {},
      ...data
    }
  });
}

export async function loginAs(username: string, password = 'password') {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username, password });

  return response.body.token;
}

export async function cleanup() {
  await prisma.apiServer.deleteMany({});
  await prisma.organization.deleteMany({ where: { isExternal: false } });
  await prisma.user.deleteMany({});
}
```

**Sample Test Case** (from TEST_PLAN.md lines 266-287):

```typescript
describe('API Server Management Authorization', () => {
  let adminToken: string;
  let viewerToken: string;
  let holngOrg: Organization;

  beforeEach(async () => {
    // Setup test data
    holngOrg = await prisma.organization.create({
      data: { code: 'HOLNG', name: 'Holcim Nigeria', serviceStatus: 'active' }
    });

    const admin = await createTestUser({
      username: 'admin',
      role: 'admin',
      organizationId: holngOrg.id,
      allowedOrganizationIds: [holngOrg.id],
      capabilities: { perm_ManageSettings: true }
    });

    const viewer = await createTestUser({
      username: 'viewer',
      role: 'viewer',
      organizationId: holngOrg.id,
      allowedOrganizationIds: [holngOrg.id],
      capabilities: { perm_ManageSettings: false }
    });

    adminToken = await loginAs('admin');
    viewerToken = await loginAs('viewer');
  });

  afterEach(async () => {
    await cleanup();
  });

  // TEST-API-001: Unauthorized Create
  it('should prevent create API Server without permission', async () => {
    const response = await request(app)
      .post('/api/api-servers')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        organizationId: holngOrg.id,
        name: 'Test Server',
        baseUrl: 'https://api.test.com',
        authType: 'bearer'
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Requires perm_ManageSettings permission');
  });

  // TEST-API-002: Authorized Create
  it('should allow create API Server with permission', async () => {
    const response = await request(app)
      .post('/api/api-servers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        organizationId: holngOrg.id,
        name: 'Test Server',
        baseUrl: 'https://api.test.com',
        authType: 'bearer'
      });

    expect(response.status).toBe(201);
    expect(response.body.organizationId).toBe(holngOrg.id);
    expect(response.body.name).toBe('Test Server');
  });

  // TEST-API-003: Cross-Org Access Prevention
  it('should prevent edit API Server in different org', async () => {
    const rioOrg = await prisma.organization.create({
      data: { code: 'RIO', name: 'Rio Tinto', serviceStatus: 'active' }
    });

    const holngServer = await prisma.apiServer.create({
      data: {
        organizationId: holngOrg.id,
        name: 'HOLNG Server',
        baseUrl: 'https://api.holng.com',
        authType: 'bearer'
      }
    });

    // Create user with permission for RIO, but not HOLNG
    const rioUser = await createTestUser({
      username: 'rio-user',
      organizationId: rioOrg.id,
      allowedOrganizationIds: [rioOrg.id],
      capabilities: { perm_ManageSettings: true }
    });

    const rioToken = await loginAs('rio-user');

    const response = await request(app)
      .patch(`/api/api-servers/${holngServer.id}`)
      .set('Authorization', `Bearer ${rioToken}`)
      .send({ name: 'Hacked' });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain("don't have permission to manage");
  });
});
```

**Key Test Categories**:

1. **Authentication Tests** (20+ tests):
   - Valid login, invalid credentials, token validation, expiration

2. **Authorization Tests** (30+ tests):
   - Permission enforcement, role-based access, capability checks

3. **API Server Management** (25+ tests):
   - CRUD operations, permission checks, org isolation, status cascading

4. **Organization Management** (20+ tests):
   - Create, suspend, delete, external entity protection

5. **Data Integrity Tests** (15+ tests):
   - Cascading deletes, foreign key constraints, transaction rollbacks

6. **Multi-Tenancy Tests** (20+ tests):
   - Org isolation, multi-org users, context switching

7. **External Entity Tests** (15+ tests):
   - PEMS org/user protection, unlinking, sync preservation

8. **Edge Cases** (26+ tests):
   - Null handling, boundary conditions, race conditions

## Your Mission

**Execute these steps**:

1. **Setup Test Infrastructure** (2 hours):
   - Create `backend/tests/integration/` folder structure
   - Set up test database (SQLite in-memory or separate test DB)
   - Configure `vitest` with coverage reporting
   - Create helper functions (createTestUser, loginAs, cleanup)

2. **Implement Core Test Suites** (12 hours):
   - Authentication & Authorization: `auth.integration.test.ts` (30+ tests)
   - API Server Management: `apiServerAuthorization.test.ts` (25+ tests)
   - Organization Management: `organizationManagement.test.ts` (20+ tests)
   - Multi-Tenancy: `multiTenantIsolation.test.ts` (20+ tests)

3. **Implement Advanced Test Suites** (8 hours):
   - External Entity Protection: `externalEntityProtection.test.ts` (15+ tests)
   - Organization Cascading: `organizationCascading.test.ts` (15+ tests)
   - Data Integrity: `dataIntegrity.test.ts` (15+ tests)
   - Edge Cases: `edgeCases.test.ts` (26+ tests)

4. **Code Coverage Analysis** (2 hours):
   - Run `vitest --coverage`
   - Identify uncovered code paths
   - Add tests to reach >80% coverage target
   - Generate HTML coverage report

5. **Performance Validation** (1 hour):
   - Verify test suite completes in <5 minutes
   - Optimize slow tests (mock external calls)
   - Parallelize independent test suites

6. **CI/CD Integration** (1 hour):
   - Create GitHub Actions workflow: `.github/workflows/integration-tests.yml`
   - Run tests on every PR
   - Fail PR if coverage drops below 80%

7. **Documentation** (1 hour):
   - Update `tests/README.md` with test suite index
   - Update `TESTING_LOG.md` with [TEST-INT-001] through [TEST-INT-171]
   - Document test execution instructions

## Deliverables

1. **Test Suites** (8 files, 171+ tests):
   - `backend/tests/integration/auth.integration.test.ts`
   - `backend/tests/integration/apiServerAuthorization.test.ts`
   - `backend/tests/integration/organizationManagement.test.ts`
   - `backend/tests/integration/multiTenantIsolation.test.ts`
   - `backend/tests/integration/externalEntityProtection.test.ts`
   - `backend/tests/integration/organizationCascading.test.ts`
   - `backend/tests/integration/dataIntegrity.test.ts`
   - `backend/tests/integration/edgeCases.test.ts`

2. **Coverage Report**: `coverage/index.html` (>80% backend coverage)

3. **CI Workflow**: `.github/workflows/integration-tests.yml`

4. **Documentation**:
   - `tests/README.md` (test suite index)
   - `TESTING_LOG.md` ([TEST-INT-001] through [TEST-INT-171] entries)

## Constraints

**❌ DO NOT**:
- Use production database for tests
- Hardcode credentials in test files (use environment variables)
- Skip cleanup after tests (causes test pollution)
- Commit failing tests to main branch

**✅ DO**:
- Use in-memory SQLite or isolated test database
- Mock external API calls (PEMS, AI providers)
- Clean up test data after each test (beforeEach/afterEach)
- Run tests before every commit (pre-commit hook)

## Verification Questions

1. **Coverage**: Does test suite achieve >80% code coverage? (Check: `vitest --coverage`)
2. **Test Count**: Are all 171+ test cases from TEST_PLAN.md implemented? (Check: test suite count)
3. **Performance**: Does full test suite run in <5 minutes? (Check: execution time)
4. **Isolation**: Do tests pass when run in random order? (Check: `vitest --sequence.shuffle`)
5. **CI Integration**: Do tests run automatically on every PR? (Check: GitHub Actions)
6. **Documentation**: Is TESTING_LOG.md updated with all test entries? (Check: log completeness)

---

# Bundle 10B.2: E2E Permission Workflow Tests

**Agent**: @sdet-test-automation

## System Context

You are a QA automation engineer specializing in **end-to-end (E2E) testing** of user workflows. Your mission is to verify that complete permission workflows work correctly from frontend to backend to database.

**What This System Does**:
- Frontend: User Management UI (components/admin/UserManagement.tsx)
- Backend: Permission grant API (POST /api/users/{id}/permissions)
- Database: User permissions stored in `capabilities` JSONB field

**Your Mission**: Test complete user journeys involving permission changes, ensuring frontend, backend, and database stay in sync.

## Business Context

**Critical Workflows**:

1. **Admin Grants Permission**:
   - Admin opens User Management → Selects user → Opens Permission Modal → Grants `perm_ManageSettings` → Saves
   - Backend updates database → User can now create API servers

2. **User Suspension**:
   - Admin suspends user → User's active session becomes invalid → User sees "Account suspended" error on next API call

3. **Organization Switch**:
   - Multi-org user switches from HOLNG to RIO → UI updates to show RIO data → User can manage RIO's API servers

**Real-World Impact**:
- **If broken**: User granted permission but cannot use it (UI/backend desync)
- **If working**: Feature is production-ready for multi-user environments

## Technical Specification

**Test Workflows** (from TEST_PLAN.md lines 929-1013):

```typescript
// Critical Flow 1: Admin Grants Permission
describe('E2E: Admin Grants Permission', () => {
  it('should complete full permission grant workflow', async () => {
    // 1. Admin logs in
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/dashboard');

    // 2. Admin navigates to User Management
    await page.click('a[href="/admin/users"]');
    await page.waitForSelector('table[data-testid="user-table"]');

    // 3. Admin opens permission modal for target user
    const targetRow = page.locator('tr', { hasText: 'alice' });
    await targetRow.locator('button[aria-label="Edit Permissions"]').click();
    await page.waitForSelector('div[data-testid="permission-modal"]');

    // 4. Admin grants perm_ManageSettings
    await page.click('input[name="perm_ManageSettings"]');
    await page.click('button:has-text("Save")');
    await page.waitForSelector('div:has-text("Permissions updated successfully")');

    // 5. Verify permission was granted (check database)
    const user = await prisma.user.findUnique({
      where: { username: 'alice' },
      select: { capabilities: true }
    });
    expect(user.capabilities.perm_ManageSettings).toBe(true);

    // 6. Verify user can now create API server (login as alice)
    await page.click('button[aria-label="Logout"]');
    await page.fill('input[name="username"]', 'alice');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    await page.goto('http://localhost:3000/admin/api-connectivity');
    await page.click('button:has-text("Add Server")');

    // Should see form (not permission error)
    await expect(page.locator('form[data-testid="server-form"]')).toBeVisible();
  });
});

// Critical Flow 2: User Suspension
describe('E2E: User Suspension', () => {
  it('should suspend user and revoke all access', async () => {
    // 1. User logs in successfully
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="username"]', 'bob');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/dashboard');

    // 2. Verify user can access data
    await page.goto('http://localhost:3000/pfa');
    await expect(page.locator('table[data-testid="pfa-table"]')).toBeVisible();

    // 3. Admin suspends user (in separate browser context)
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await adminPage.goto('http://localhost:3000/login');
    await adminPage.fill('input[name="username"]', 'admin');
    await adminPage.fill('input[name="password"]', 'admin123');
    await adminPage.click('button[type="submit"]');

    await adminPage.goto('http://localhost:3000/admin/users');
    const bobRow = adminPage.locator('tr', { hasText: 'bob' });
    await bobRow.locator('button[aria-label="Suspend User"]').click();
    await adminPage.click('button:has-text("Confirm")');
    await adminPage.waitForSelector('div:has-text("User suspended")');

    // 4. Verify user is suspended in database
    const user = await prisma.user.findUnique({
      where: { username: 'bob' },
      select: { serviceStatus: true, suspendedAt: true }
    });
    expect(user.serviceStatus).toBe('suspended');
    expect(user.suspendedAt).toBeTruthy();

    // 5. Verify user cannot access data anymore (back to original tab)
    await page.reload();  // Trigger API call

    // Should see suspension error
    await expect(page.locator('div:has-text("Account suspended")')).toBeVisible();
    await expect(page.locator('table[data-testid="pfa-table"]')).not.toBeVisible();
  });
});

// Critical Flow 3: Organization Switch
describe('E2E: Organization Switch', () => {
  it('should switch context and update UI data', async () => {
    // 1. User logs in (multi-org user)
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="username"]', 'multi-user');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // 2. User is initially in HOLNG context
    await page.waitForSelector('div[data-testid="org-selector"]');
    await expect(page.locator('div[data-testid="current-org"]')).toHaveText('HOLNG');

    // 3. Load API servers page (should show HOLNG servers)
    await page.goto('http://localhost:3000/admin/api-connectivity');
    await page.waitForSelector('table[data-testid="server-table"]');

    const holngServers = await page.locator('tr[data-org="HOLNG"]').count();
    expect(holngServers).toBe(2);  // HOLNG has 2 servers

    const rioServers = await page.locator('tr[data-org="RIO"]').count();
    expect(rioServers).toBe(0);  // RIO servers not visible yet

    // 4. Switch to RIO organization
    await page.click('div[data-testid="org-selector"]');
    await page.click('li:has-text("RIO")');
    await page.waitForSelector('div[data-testid="current-org"]:has-text("RIO")');

    // 5. Verify UI updated to show RIO servers
    await page.waitForSelector('table[data-testid="server-table"]');

    const rioServersAfterSwitch = await page.locator('tr[data-org="RIO"]').count();
    expect(rioServersAfterSwitch).toBe(1);  // RIO has 1 server

    const holngServersAfterSwitch = await page.locator('tr[data-org="HOLNG"]').count();
    expect(holngServersAfterSwitch).toBe(0);  // HOLNG servers now hidden

    // 6. Verify user can manage RIO servers
    await page.click('button:has-text("Add Server")');
    await page.fill('input[name="name"]', 'RIO Server 2');
    await page.fill('input[name="baseUrl"]', 'https://api.rio2.com');
    await page.click('button:has-text("Save")');

    // Should create server in RIO org
    const newServer = await prisma.apiServer.findFirst({
      where: { name: 'RIO Server 2', organizationId: 'RIO' }
    });
    expect(newServer).toBeTruthy();
  });
});
```

**Additional Workflows**:

1. **Permission Revocation**: Admin revokes permission → User loses access immediately
2. **Role Change**: Admin changes user role → Capabilities update → UI reflects new permissions
3. **Multi-Org Access Grant**: Admin adds user to new organization → User can switch to it
4. **Account Reactivation**: Admin unsuspends user → User can login again

## Your Mission

**Execute these steps**:

1. **Setup E2E Test Framework** (2 hours):
   - Install Playwright: `npm install -D @playwright/test`
   - Create `tests/e2e/` folder structure
   - Configure `playwright.config.ts` with base URL, timeouts
   - Set up test database seeding script

2. **Implement Permission Workflows** (6 hours):
   - Admin Grants Permission: `permissionGrant.e2e.test.ts`
   - Admin Revokes Permission: `permissionRevoke.e2e.test.ts`
   - User Suspension: `userSuspension.e2e.test.ts`
   - Account Reactivation: `accountReactivation.e2e.test.ts`

3. **Implement Org Workflows** (4 hours):
   - Organization Switch: `orgSwitch.e2e.test.ts`
   - Multi-Org Access Grant: `multiOrgAccess.e2e.test.ts`
   - Organization Suspension: `orgSuspension.e2e.test.ts`

4. **Visual Regression Testing** (2 hours):
   - Capture screenshots of key UI states (permission modal, user table)
   - Compare with baseline screenshots
   - Flag UI regressions

5. **Performance Testing** (1 hour):
   - Measure page load times
   - Verify permission grant completes in <2 seconds
   - Check for memory leaks (long-running sessions)

6. **Error Scenarios** (2 hours):
   - Test permission grant failure (backend error)
   - Test suspension mid-session (user has page open)
   - Test network failures during permission save

7. **Documentation** (1 hour):
   - Create `tests/e2e/README.md` with workflow descriptions
   - Update TESTING_LOG.md with [TEST-E2E-001] through [TEST-E2E-010]
   - Add screenshots to `docs/testing/screenshots/`

## Deliverables

1. **E2E Test Suites** (7 files, 30+ tests):
   - `tests/e2e/permissionGrant.e2e.test.ts`
   - `tests/e2e/permissionRevoke.e2e.test.ts`
   - `tests/e2e/userSuspension.e2e.test.ts`
   - `tests/e2e/accountReactivation.e2e.test.ts`
   - `tests/e2e/orgSwitch.e2e.test.ts`
   - `tests/e2e/multiOrgAccess.e2e.test.ts`
   - `tests/e2e/orgSuspension.e2e.test.ts`

2. **Playwright Config**: `playwright.config.ts`

3. **Test Data Seeding**: `tests/e2e/fixtures/seed.ts`

4. **Documentation**:
   - `tests/e2e/README.md` (workflow descriptions)
   - `TESTING_LOG.md` ([TEST-E2E-001] through [TEST-E2E-030] entries)
   - `docs/testing/screenshots/` (baseline UI screenshots)

## Constraints

**❌ DO NOT**:
- Run E2E tests against production
- Use production user credentials
- Commit test database state
- Run E2E tests in parallel (causes race conditions)

**✅ DO**:
- Use headless mode in CI (`headless: true`)
- Seed test database before each test suite
- Clean up test data after tests
- Use test-specific user accounts (test-admin, test-user)

## Verification Questions

1. **Workflow Coverage**: Are all 3 critical flows from TEST_PLAN.md implemented? (Check: test file count)
2. **Frontend-Backend Sync**: Do permission changes in UI reflect in database immediately? (Check: test assertions)
3. **Error Handling**: Do tests verify error states (suspension, permission denied)? (Check: negative test cases)
4. **Performance**: Does permission grant complete in <2 seconds? (Check: test timing)
5. **Visual Regression**: Are UI screenshots captured for key states? (Check: screenshots/ folder)
6. **CI Integration**: Do E2E tests run on every PR? (Check: GitHub Actions workflow)

---

# Bundle 10B.3: Load Testing

**Agent**: @sdet-test-automation

## System Context

You are a performance testing engineer specializing in **load testing** and **stress testing** for multi-tier applications. Your mission is to validate that the Multi-Tenant Access Control system can handle **1000 concurrent users** without degradation.

**What This System Does**:
- Handles concurrent permission checks (middleware on every API request)
- Manages database connection pool (Prisma with PostgreSQL)
- Processes permission grants/revocations (write-heavy operations)

**Your Mission**: Simulate real-world load and identify performance bottlenecks.

## Business Context

**Load Testing Scenarios**:

1. **Concurrent Permission Checks**: 1000 users simultaneously call `/api/pfa` → All requests complete in <200ms
2. **Permission Grant Storm**: 50 admins simultaneously grant permissions → No database deadlocks
3. **Organization Switch**: 100 users switch orgs concurrently → No race conditions

**Why This Matters**:
- **Production Readiness**: System must handle peak traffic without crashes
- **User Experience**: Slow permission checks (<50ms target) cause UI lag
- **Cost Optimization**: Identify if infrastructure scaling is needed

## Technical Specification

**Performance Targets** (from TEST_PLAN.md lines 863-878):

| Operation | P50 Latency | P95 Latency | Target Throughput | Max Concurrent Users |
|-----------|-------------|-------------|-------------------|----------------------|
| **Permission Check** | <50ms | <100ms | 2000 req/s | 200 |
| **Grant Permission** | <100ms | <200ms | 500 req/s | 50 |
| **API Server List** | <200ms | <400ms | 100 req/s | 50 |
| **Organization Status Check** | <100ms | <200ms | 500 req/s | 100 |

**Load Test Scenarios** (TEST_PLAN.md lines 880-906):

```typescript
// Scenario 1: Concurrent Permission Grants
describe('Load: Concurrent Permission Grants', () => {
  it('should handle 50 simultaneous permission grants without errors', async () => {
    const promises = Array(50).fill(null).map((_, i) =>
      grantPermission(adminToken, {
        userId: `user-${i}`,
        organizationId: 'org-1',
        role: 'editor'
      })
    );

    const start = Date.now();
    const results = await Promise.all(promises);
    const duration = Date.now() - start;

    // Verify all succeeded
    const failures = results.filter(r => r.status !== 200);
    expect(failures.length).toBe(0);

    // Verify P95 latency <200ms (95% completed within 200ms)
    expect(duration).toBeLessThan(200);
  });
});

// Scenario 2: Database Connection Pool Stress
describe('Load: Connection Pool Stress', () => {
  it('should not exhaust database connections under load', async () => {
    const operations = Array(200).fill(null).map(() =>
      checkUserPermission('user-1', 'org-1')  // Read-only query
    );

    // Should not throw "Connection pool exhausted" error
    await expect(Promise.all(operations)).resolves.not.toThrow();

    // Verify connection pool metrics
    const poolMetrics = await prisma.$metrics.json();
    expect(poolMetrics.connections.active).toBeLessThan(poolMetrics.connections.max);
  });
});

// Scenario 3: Memory Leak Detection
describe('Load: Memory Leak Detection', () => {
  it('should not leak memory over 1000 operations', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < 1000; i++) {
      await checkUserPermission('user-1', 'org-1');
    }

    global.gc();  // Force garbage collection
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024;

    // Memory growth should be <50MB
    expect(memoryGrowth).toBeLessThan(50);
  });
});
```

**Load Testing Tools**:

1. **Artillery** (Recommended):
```yaml
# load-tests/permission-check.yml
config:
  target: http://localhost:3001
  phases:
    - duration: 60
      arrivalRate: 10
      name: Warm up
    - duration: 120
      arrivalRate: 100
      name: Sustained load
    - duration: 60
      arrivalRate: 200
      name: Spike test

  defaults:
    headers:
      Authorization: "Bearer {{ $processEnvironment.TEST_TOKEN }}"

scenarios:
  - name: "Permission Check Load Test"
    flow:
      - get:
          url: "/api/pfa?organizationId=HOLNG"
          capture:
            - json: "$.length"
              as: "recordCount"
      - think: 1  # 1 second pause between requests
```

2. **k6** (Alternative):
```javascript
// load-tests/permission-check.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Warm up
    { duration: '2m', target: 100 },  // Sustained load
    { duration: '1m', target: 200 },  // Spike
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],  // 95% of requests <200ms
    http_req_failed: ['rate<0.01'],    // <1% failure rate
  },
};

export default function () {
  const token = __ENV.TEST_TOKEN;
  const res = http.get('http://localhost:3001/api/pfa?organizationId=HOLNG', {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time <200ms': (r) => r.timings.duration < 200,
  });

  sleep(1);
}
```

## Your Mission

**Execute these steps**:

1. **Setup Load Testing Environment** (2 hours):
   - Install Artillery: `npm install -D artillery`
   - Or install k6: Download from https://k6.io
   - Create test data: 1000 test users, 10 organizations
   - Set up performance monitoring (CPU, memory, DB connections)

2. **Permission Check Load Tests** (3 hours):
   - Test `/api/pfa` endpoint with 200 concurrent users
   - Measure P50, P95, P99 latencies
   - Monitor database connection pool usage
   - Identify bottlenecks (slow queries, missing indexes)

3. **Permission Grant Load Tests** (2 hours):
   - Test concurrent permission grants (50 admins)
   - Check for database deadlocks
   - Verify data integrity (no lost updates)

4. **Organization Switch Load Tests** (2 hours):
   - Simulate 100 users switching orgs simultaneously
   - Monitor API response times
   - Check for race conditions

5. **Database Stress Tests** (3 hours):
   - Test connection pool limits (default: 10 connections)
   - Simulate connection pool exhaustion
   - Test query performance under load (slow query log)

6. **Memory Leak Detection** (2 hours):
   - Run 1000+ operations monitoring heap usage
   - Force garbage collection
   - Identify memory leaks (use Node.js `--inspect`)

7. **Generate Load Test Report** (1 hour):
   - Create HTML report with Artillery/k6
   - Document P50, P95, P99 latencies
   - List bottlenecks found
   - Provide optimization recommendations

## Deliverables

1. **Load Test Scripts**:
   - `load-tests/permission-check.yml` (Artillery config)
   - `load-tests/permission-grant.yml`
   - `load-tests/org-switch.yml`
   - `load-tests/db-stress.yml`

2. **Performance Report**: `docs/performance/LOAD_TEST_REPORT.md` with:
   - Latency charts (P50, P95, P99)
   - Throughput metrics (requests/second)
   - Error rate analysis
   - Bottleneck identification
   - Optimization recommendations

3. **Monitoring Dashboard**: `docs/performance/MONITORING_SETUP.md`

4. **TESTING_LOG.md Update**: [TEST-LOAD-001] with execution results

## Constraints

**❌ DO NOT**:
- Run load tests against production
- Exceed database connection limits (crashes DB)
- Run tests during business hours (shared dev environment)
- Use real user data for tests

**✅ DO**:
- Use isolated test environment (staging/QA)
- Monitor server resources during tests (CPU, RAM, DB)
- Clean up test data after tests
- Document baseline performance metrics

## Verification Questions

1. **Concurrent Users**: Can system handle 1000 concurrent users? (Check: error rate <1%)
2. **Latency**: Do 95% of requests complete in <200ms? (Check: P95 latency)
3. **Connection Pool**: Does system avoid connection pool exhaustion? (Check: DB metrics)
4. **Memory**: Does memory usage stay stable over 1000+ operations? (Check: heap growth <50MB)
5. **Throughput**: Can system process 2000 permission checks/second? (Check: requests/second)
6. **Error Rate**: Do all permission grants succeed under load? (Check: <1% failure rate)

---

# Bundle 10B.4: Performance Benchmarking

**Agent**: @sdet-test-automation

## System Context

You are a performance engineering specialist focused on **latency measurement** and **optimization**. Your mission is to establish baseline performance metrics for the Multi-Tenant Access Control system and verify the **<50ms authorization overhead** requirement.

**What This System Does**:
- Middleware checks user permissions on every API request
- Database queries filtered by organizationId (indexes critical)
- Permission checks use JSONB field queries (capabilities JSONB)

**Your Mission**: Measure and optimize authorization overhead to meet <50ms target.

## Business Context

**Performance Requirements**:

1. **Authorization Overhead**: Permission check middleware must add <50ms to API requests
2. **Database Query Latency**: PfaRecord queries must return in <100ms
3. **API Response Time**: Protected endpoints must respond in <200ms

**Why This Matters**:
- **User Experience**: Every API call includes permission check → slow checks = slow app
- **Cost**: Slow queries = more database load = higher cloud costs
- **Scalability**: 50ms overhead × 10,000 requests/day = 500 seconds wasted

## Technical Specification

**Performance Targets** (from TEST_PLAN.md line 874):

| Operation | Target Latency | P95 Latency | P99 Latency |
|-----------|----------------|-------------|-------------|
| **Authorization Middleware** | <50ms | <75ms | <100ms |
| **Database Query (by org)** | <100ms | <150ms | <200ms |
| **API Response (protected)** | <200ms | <300ms | <400ms |

**Benchmarking Approach**:

```typescript
// backend/tests/performance/authorizationBenchmark.test.ts
import { performance } from 'perf_hooks';
import { verifyToken } from '../../src/middleware/auth';
import { checkPermission } from '../../src/middleware/requirePermission';

describe('Performance: Authorization Overhead', () => {
  let token: string;
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(async () => {
    // Create test user and generate token
    const user = await createTestUser({
      username: 'perftest',
      role: 'editor',
      capabilities: { perm_ManageSettings: true }
    });
    token = generateToken(user);

    // Mock Express request/response
    mockReq = {
      headers: { authorization: `Bearer ${token}` },
      user: null
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  it('should verify token in <50ms', async () => {
    const iterations = 1000;
    const timings = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await verifyToken(mockReq, mockRes, mockNext);
      const end = performance.now();
      timings.push(end - start);
    }

    // Calculate percentiles
    timings.sort((a, b) => a - b);
    const p50 = timings[Math.floor(iterations * 0.5)];
    const p95 = timings[Math.floor(iterations * 0.95)];
    const p99 = timings[Math.floor(iterations * 0.99)];

    console.log(`Token Verification Latency:
      P50: ${p50.toFixed(2)}ms
      P95: ${p95.toFixed(2)}ms
      P99: ${p99.toFixed(2)}ms
    `);

    expect(p95).toBeLessThan(50);  // P95 < 50ms
  });

  it('should check permission in <50ms', async () => {
    const iterations = 1000;
    const timings = [];

    // Pre-authenticate user
    await verifyToken(mockReq, mockRes, mockNext);

    for (let i = 0; i < iterations; i++) {
      mockReq.user = { capabilities: { perm_ManageSettings: true } };

      const start = performance.now();
      await checkPermission('perm_ManageSettings')(mockReq, mockRes, mockNext);
      const end = performance.now();
      timings.push(end - start);
    }

    timings.sort((a, b) => a - b);
    const p95 = timings[Math.floor(iterations * 0.95)];

    expect(p95).toBeLessThan(50);
  });

  it('should query PfaRecords by org in <100ms', async () => {
    // Seed database with 10,000 PFA records
    await seedPfaRecords(10000, 'HOLNG');

    const iterations = 100;
    const timings = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const records = await prisma.pfaRecord.findMany({
        where: { organizationId: 'HOLNG' },
        take: 100
      });
      const end = performance.now();
      timings.push(end - start);
    }

    timings.sort((a, b) => a - b);
    const p95 = timings[Math.floor(iterations * 0.95)];

    console.log(`Database Query Latency (10K records):
      P50: ${timings[Math.floor(iterations * 0.5)].toFixed(2)}ms
      P95: ${p95.toFixed(2)}ms
    `);

    expect(p95).toBeLessThan(100);
  });
});
```

**Database Optimization Checks**:

```sql
-- Verify indexes exist
EXPLAIN ANALYZE
SELECT * FROM pfa_records
WHERE "organizationId" = 'HOLNG'
LIMIT 100;

-- Expected: Index Scan using idx_pfa_org
-- NOT: Seq Scan (sequential scan = missing index)

-- Check JSONB query performance
EXPLAIN ANALYZE
SELECT * FROM users
WHERE capabilities @> '{"perm_ManageSettings": true}';

-- Expected: Index Scan using idx_user_capabilities (GIN index)
```

## Your Mission

**Execute these steps**:

1. **Setup Performance Testing Environment** (1 hour):
   - Create `backend/tests/performance/` folder
   - Install `perf_hooks` for timing (built-in Node.js)
   - Seed test database with realistic data (10K+ records)

2. **Measure Authorization Overhead** (3 hours):
   - Benchmark `verifyToken()` middleware (1000 iterations)
   - Benchmark `checkPermission()` middleware (1000 iterations)
   - Calculate P50, P95, P99 latencies
   - Identify bottlenecks (JWT verification, database lookup)

3. **Measure Database Query Performance** (3 hours):
   - Benchmark PfaRecord queries (by organizationId)
   - Benchmark User queries (JSONB capabilities filter)
   - Benchmark ApiServer queries (multi-tenant isolation)
   - Run EXPLAIN ANALYZE to verify index usage

4. **API Response Time Benchmarking** (2 hours):
   - Measure end-to-end latency for protected endpoints
   - Breakdown: Authorization (middleware) + Business Logic + Database + Serialization
   - Identify slowest component

5. **Optimization Recommendations** (2 hours):
   - If authorization >50ms: Optimize JWT library, cache decoded tokens
   - If database >100ms: Add indexes, optimize queries
   - If serialization >50ms: Use faster JSON library

6. **Database Index Validation** (1 hour):
   - Verify all critical indexes exist:
     - `idx_pfa_org` on `pfaRecords(organizationId)`
     - `idx_user_capabilities` on `users(capabilities)` (GIN index)
     - `idx_apiserver_org` on `apiServers(organizationId)`
   - Run EXPLAIN ANALYZE to confirm usage

7. **Create Performance Report** (1 hour):
   - Document baseline metrics
   - Compare against targets
   - List optimizations applied
   - Show before/after measurements

## Deliverables

1. **Performance Test Suites**:
   - `backend/tests/performance/authorizationBenchmark.test.ts`
   - `backend/tests/performance/databaseQueryBenchmark.test.ts`
   - `backend/tests/performance/apiResponseBenchmark.test.ts`

2. **Benchmark Report**: `docs/performance/BENCHMARK_REPORT.md` with:
   - Latency tables (P50, P95, P99)
   - Database query plans (EXPLAIN ANALYZE output)
   - Optimization recommendations
   - Before/after comparisons

3. **Index Validation Script**: `backend/scripts/db/verify-indexes.ts`

4. **TESTING_LOG.md Update**: [TEST-PERF-001] with benchmark results

## Constraints

**❌ DO NOT**:
- Run benchmarks on shared development database
- Use production data for benchmarks
- Optimize prematurely (measure first, then optimize)
- Ignore P99 latency (affects real users)

**✅ DO**:
- Use isolated test database with realistic data
- Run benchmarks multiple times (average results)
- Document hardware specs (affects absolute numbers)
- Compare relative improvements (10% faster = good)

## Verification Questions

1. **Authorization Overhead**: Is P95 latency <50ms? (Check: benchmark results)
2. **Database Performance**: Is P95 query latency <100ms? (Check: EXPLAIN ANALYZE)
3. **Index Usage**: Are all queries using indexes? (Check: EXPLAIN output shows "Index Scan")
4. **API Response Time**: Is P95 response time <200ms? (Check: end-to-end benchmark)
5. **Optimization Impact**: Did optimizations improve latency? (Check: before/after comparison)
6. **Scalability**: Does performance degrade with 10K+ records? (Check: benchmark with large dataset)

---

# Bundle 10B.5: Accessibility Compliance Testing

**Agent**: @design-review

## System Context

You are a UX accessibility specialist focused on **WCAG 2.1 AA compliance**. Your mission is to verify that the Multi-Tenant Access Control UI is accessible to users with disabilities, including screen reader users and keyboard-only navigation.

**What This System Does**:
- User Management UI (components/admin/UserManagement.tsx)
- Permission Modal (components/PermissionModal.tsx)
- API Server Manager (components/admin/ApiServerManager.tsx)

**Your Mission**: Ensure all UI components meet WCAG 2.1 AA standards.

## Business Context

**Accessibility Requirements** (from UX_SPEC.md):

1. **Keyboard Navigation**: All interactive elements must be keyboard-accessible (no mouse required)
2. **Screen Reader Support**: All information must be readable by screen readers (ARIA labels, semantic HTML)
3. **Color Contrast**: Text must have 4.5:1 contrast ratio (AA standard)
4. **Focus Management**: Focus order must be logical, focus indicators must be visible

**Real-World Impact**:
- **Legal**: WCAG compliance required for government contracts
- **Inclusion**: 15% of users have disabilities (WHO)
- **SEO**: Accessible sites rank higher in search

## Technical Specification

**WCAG 2.1 AA Criteria** (Priority Areas):

1. **Perceivable**:
   - Text alternatives for images (alt text)
   - Color contrast ≥4.5:1
   - Resize text up to 200% without loss of functionality

2. **Operable**:
   - Keyboard accessible (no mouse traps)
   - Focus visible (outline on focused elements)
   - Bypass blocks (skip to main content)

3. **Understandable**:
   - Readable text (clear language)
   - Predictable navigation (consistent layout)
   - Input assistance (error messages, labels)

4. **Robust**:
   - Valid HTML (no parsing errors)
   - ARIA attributes correct
   - Compatible with assistive technologies

**Test Cases**:

```typescript
describe('Accessibility: User Management', () => {
  // Test 1: Keyboard Navigation
  it('should navigate through user table using keyboard', async () => {
    await page.goto('http://localhost:3000/admin/users');

    // Tab through interactive elements
    await page.keyboard.press('Tab');  // First row "Edit" button
    await expect(page.locator('button:focus')).toHaveText('Edit Permissions');

    await page.keyboard.press('Tab');  // "Suspend" button
    await expect(page.locator('button:focus')).toHaveText('Suspend User');

    await page.keyboard.press('Tab');  // Next row
    // Should continue to next row, not skip outside table

    // No keyboard traps
    await page.keyboard.press('Escape');
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible();
  });

  // Test 2: Screen Reader Support
  it('should have proper ARIA labels for screen readers', async () => {
    await page.goto('http://localhost:3000/admin/users');

    // Table should have aria-label
    const table = page.locator('table[data-testid="user-table"]');
    await expect(table).toHaveAttribute('aria-label', 'User list');

    // Buttons should have aria-labels
    const editButton = page.locator('button[aria-label="Edit permissions for alice"]').first();
    await expect(editButton).toBeVisible();

    // Status indicators should have accessible text
    const statusBadge = page.locator('span:has-text("Active")').first();
    await expect(statusBadge).toHaveAttribute('role', 'status');
  });

  // Test 3: Color Contrast
  it('should meet WCAG AA color contrast requirements', async () => {
    await page.goto('http://localhost:3000/admin/users');

    // Check text contrast (4.5:1 minimum)
    const textColor = await page.locator('td').first().evaluate(el =>
      window.getComputedStyle(el).color
    );
    const bgColor = await page.locator('td').first().evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );

    const contrast = calculateContrast(textColor, bgColor);
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });

  // Test 4: Focus Management
  it('should trap focus inside modal when open', async () => {
    await page.goto('http://localhost:3000/admin/users');

    // Open permission modal
    await page.click('button[aria-label="Edit Permissions"]');
    await page.waitForSelector('div[role="dialog"]');

    // Focus should be on first interactive element (checkbox)
    await expect(page.locator('input[type="checkbox"]:focus')).toBeVisible();

    // Tab through modal elements
    await page.keyboard.press('Tab');  // Next checkbox
    await page.keyboard.press('Tab');  // Save button
    await page.keyboard.press('Tab');  // Cancel button
    await page.keyboard.press('Tab');  // Should loop back to first checkbox

    const focusedElement = await page.locator(':focus').getAttribute('name');
    expect(focusedElement).toBe('perm_ManageUsers');  // First checkbox
  });

  // Test 5: Form Validation Accessibility
  it('should announce form errors to screen readers', async () => {
    await page.goto('http://localhost:3000/admin/api-connectivity');

    // Open server form
    await page.click('button:has-text("Add Server")');

    // Submit without filling required fields
    await page.click('button:has-text("Save")');

    // Error message should have role="alert"
    const errorMessage = page.locator('div[role="alert"]:has-text("Base URL is required")');
    await expect(errorMessage).toBeVisible();

    // Error should be associated with input
    const input = page.locator('input[name="baseUrl"]');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveAttribute('aria-describedby', expect.stringContaining('error'));
  });
});
```

**Automated Accessibility Testing**:

```typescript
// Use axe-core for automated WCAG checks
import { injectAxe, checkA11y } from 'axe-playwright';

describe('Accessibility: Automated Checks', () => {
  beforeEach(async ({ page }) => {
    await injectAxe(page);
  });

  it('should have no WCAG violations on User Management page', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/users');
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true }
    });
  });

  it('should have no WCAG violations on Permission Modal', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/users');
    await page.click('button[aria-label="Edit Permissions"]');
    await checkA11y(page, 'div[role="dialog"]');
  });
});
```

## Your Mission

**Execute these steps**:

1. **Setup Accessibility Testing Tools** (1 hour):
   - Install `axe-playwright`: `npm install -D axe-playwright`
   - Install Lighthouse CLI: `npm install -D lighthouse`
   - Set up manual testing with NVDA (screen reader)

2. **Automated Accessibility Audits** (2 hours):
   - Run axe-core on all admin pages
   - Run Lighthouse accessibility audit
   - Document all violations found
   - Categorize by severity (Critical, High, Medium, Low)

3. **Keyboard Navigation Testing** (3 hours):
   - Test all interactive elements (buttons, inputs, links)
   - Verify tab order is logical
   - Check for keyboard traps (modals, dropdowns)
   - Test Escape key closes modals

4. **Screen Reader Testing** (4 hours):
   - Test with NVDA (Windows) or VoiceOver (Mac)
   - Verify all text is readable
   - Check ARIA labels are accurate
   - Test form validation announcements

5. **Color Contrast Validation** (1 hour):
   - Use WebAIM Color Contrast Checker
   - Verify all text meets 4.5:1 ratio (AA)
   - Check interactive states (hover, focus, disabled)

6. **Focus Management** (2 hours):
   - Test modal focus trap
   - Verify focus indicators visible
   - Check focus restoration after modal close

7. **Create Remediation Plan** (1 hour):
   - List all violations found
   - Prioritize fixes (Critical → Low)
   - Provide code examples for fixes
   - Estimate effort (hours per fix)

## Deliverables

1. **Accessibility Test Suite**: `tests/accessibility/a11y.test.ts` (20+ tests)

2. **Accessibility Audit Report**: `docs/accessibility/WCAG_AUDIT_REPORT.md` with:
   - Automated scan results (axe-core, Lighthouse)
   - Manual testing results (keyboard, screen reader)
   - Violations list with severity
   - Remediation plan with code examples

3. **WCAG Compliance Checklist**: `docs/accessibility/WCAG_CHECKLIST.md`

4. **TESTING_LOG.md Update**: [TEST-A11Y-001] with audit results

## Constraints

**❌ DO NOT**:
- Rely solely on automated tools (miss 30-50% of issues)
- Ignore keyboard navigation (critical for accessibility)
- Use color alone to convey information
- Auto-focus elements on page load (disorienting)

**✅ DO**:
- Test with real screen readers (NVDA, VoiceOver)
- Use semantic HTML (header, nav, main, button)
- Provide text alternatives for icons
- Test with keyboard only (no mouse)

## Verification Questions

1. **Keyboard Navigation**: Can user complete all tasks without mouse? (Test: navigate user table with Tab/Enter)
2. **Screen Reader Support**: Can screen reader user understand all information? (Test: NVDA announcement check)
3. **Color Contrast**: Does all text meet 4.5:1 contrast ratio? (Test: WebAIM contrast checker)
4. **Focus Management**: Is focus trapped in modals? (Test: Tab through modal)
5. **Form Accessibility**: Are form errors announced to screen readers? (Test: submit invalid form)
6. **WCAG Compliance**: Are all Critical/High violations fixed? (Test: axe-core scan = 0 violations)

---

# Bundle 10B.6: Documentation Review

**Agent**: @documentation-synthesizer

## System Context

You are a technical documentation specialist focused on **API documentation**, **user guides**, and **admin manuals**. Your mission is to ensure all documentation for the Multi-Tenant Access Control feature is complete, accurate, and user-friendly.

**What This System Does**:
- Multi-tenant RBAC system with permissions and capabilities
- API Server Management with organization isolation
- User and Organization Management with status control

**Your Mission**: Review and update all documentation to production-ready standards.

## Business Context

**Documentation Gaps**:

1. **API Documentation**: New endpoints (POST /api/users/{id}/permissions) missing from API_REFERENCE.md
2. **User Guide**: No instructions for admins on how to grant permissions
3. **Admin Manual**: No troubleshooting guide for permission issues

**Why This Matters**:
- **Onboarding**: New admins need clear instructions to manage users
- **Support**: Support team needs troubleshooting guides to resolve issues
- **Developer Experience**: API documentation must be accurate and complete

## Technical Specification

**Documentation Review Checklist** (DOCUMENTATION_STANDARDS.md):

1. **API Reference** (`docs/backend/API_REFERENCE.md`):
   - ✅ All endpoints documented with request/response examples
   - ✅ Authentication requirements specified
   - ✅ Error codes and messages listed
   - ✅ Query parameters and filters explained

2. **User Guide** (`docs/user/USER_GUIDE.md`):
   - ✅ Step-by-step instructions for common tasks
   - ✅ Screenshots for complex workflows
   - ✅ Troubleshooting section for common issues

3. **Admin Manual** (`docs/user/ADMIN_GUIDE.md`):
   - ✅ User management instructions (create, suspend, grant permissions)
   - ✅ Organization management (create, suspend, delete)
   - ✅ API Server management (add, test, edit, delete)
   - ✅ Security best practices

4. **Architecture Documentation** (`docs/ARCHITECTURE.md`):
   - ✅ Updated with Multi-Tenant Access Control design
   - ✅ Database schema reflects new tables/fields
   - ✅ API endpoints list updated

5. **README.md** (Project root):
   - ✅ Current features list includes Multi-Tenant Access Control
   - ✅ Getting started instructions updated
   - ✅ Links to new documentation sections

**Documentation Gaps to Fill**:

```markdown
# docs/backend/API_REFERENCE.md (ADD NEW SECTION)

## User Management Endpoints

### POST /api/users/{userId}/permissions
Grant or revoke permissions for a user.

**Authentication:** Required (JWT token with `perm_ManageUsers` capability)

**Request:**
```json
{
  "capabilities": {
    "perm_ManageUsers": true,
    "perm_ManageSettings": false,
    "viewFinancialDetails": true
  }
}
```

**Response (200 OK):**
```json
{
  "id": "user-123",
  "username": "alice",
  "capabilities": {
    "perm_ManageUsers": true,
    "perm_ManageSettings": false,
    "viewFinancialDetails": true
  },
  "updatedAt": "2025-11-27T10:30:00Z"
}
```

**Error Responses:**
- `401 Unauthorized` - No JWT token provided
- `403 Forbidden` - User lacks `perm_ManageUsers` capability
- `404 Not Found` - User ID does not exist

---

# docs/user/ADMIN_GUIDE.md (ADD NEW SECTION)

## Managing User Permissions

### How to Grant Permissions

1. **Navigate to User Management:**
   - Click "Administration" in sidebar
   - Select "User Management"

2. **Select User:**
   - Find the user in the table
   - Click the "Edit Permissions" button (pencil icon)

3. **Grant Permissions:**
   - Check the permissions you want to grant:
     - **Manage Users**: Create, edit, suspend users
     - **Manage Settings**: Create, edit API servers
     - **View Financial Details**: See cost data in PFA records
   - Click "Save"

4. **Verify:**
   - User should see new permissions immediately
   - Log in as the user to confirm access

**Screenshot:** [Insert screenshot of Permission Modal here]

### Troubleshooting Permission Issues

#### "User has permission but cannot perform action"

**Possible Causes:**
1. **Browser cache:** User needs to refresh page or re-login
2. **Permission not saved:** Check database (capabilities JSONB field)
3. **Bug in permission check:** Check backend logs

**Solution:**
1. Have user logout and login again
2. Verify permission in database:
   ```sql
   SELECT capabilities FROM users WHERE id = 'user-123';
   ```
3. If still broken, contact development team

#### "Permission modal shows loading indefinitely"

**Possible Causes:**
1. **API endpoint down:** Check backend server status
2. **Network error:** Check browser console

**Solution:**
1. Refresh page
2. Check backend logs for errors
3. Verify API endpoint: `GET /api/users/{id}`
```

**Documentation Quality Checklist**:

- [ ] **Accuracy**: All information is correct and up-to-date
- [ ] **Completeness**: No missing endpoints or features
- [ ] **Clarity**: Easy to understand for target audience
- [ ] **Examples**: Code examples for all API endpoints
- [ ] **Screenshots**: Visual guides for complex UI workflows
- [ ] **Searchability**: Good headings, table of contents, index
- [ ] **Consistency**: Consistent formatting and terminology
- [ ] **Accessibility**: Proper heading hierarchy (H1 → H2 → H3)

## Your Mission

**Execute these steps**:

1. **API Documentation Review** (3 hours):
   - Review `docs/backend/API_REFERENCE.md`
   - Add missing endpoints (POST /api/users/{id}/permissions, PATCH /api/users/{id}/suspend, etc.)
   - Verify request/response examples match actual implementation
   - Add error code documentation
   - Test all examples (copy-paste into Postman/curl)

2. **User Guide Creation** (4 hours):
   - Create `docs/user/USER_GUIDE.md` for end users
   - Write step-by-step instructions for:
     - Viewing user list
     - Checking permissions
     - Switching organizations
   - Add screenshots for each workflow
   - Include troubleshooting section

3. **Admin Manual Creation** (5 hours):
   - Create `docs/user/ADMIN_GUIDE.md` for administrators
   - Write step-by-step instructions for:
     - Creating users
     - Granting/revoking permissions
     - Suspending/unsuspending users
     - Managing organizations
     - Managing API servers
   - Add security best practices
   - Include troubleshooting guide

4. **Architecture Documentation Update** (2 hours):
   - Update `docs/ARCHITECTURE.md` with:
     - Multi-Tenant Access Control section
     - Database schema changes (capabilities JSONB, serviceStatus enum)
     - New API endpoints
   - Update architecture diagrams

5. **README.md Update** (1 hour):
   - Add "Multi-Tenant Access Control" to Features section
   - Update "Getting Started" with admin login
   - Add links to new documentation

6. **Cross-Reference Verification** (1 hour):
   - Verify all internal links work
   - Check that examples reference correct endpoints
   - Ensure terminology is consistent across docs

7. **Documentation Review Checklist** (1 hour):
   - Create `docs/DOCUMENTATION_REVIEW_CHECKLIST.md`
   - Run through checklist for all documents
   - Fix any issues found

## Deliverables

1. **Updated API Documentation**: `docs/backend/API_REFERENCE.md` (complete endpoint list)

2. **User Guide**: `docs/user/USER_GUIDE.md` (20+ pages)

3. **Admin Manual**: `docs/user/ADMIN_GUIDE.md` (30+ pages)

4. **Architecture Update**: `docs/ARCHITECTURE.md` (Multi-Tenant Access Control section)

5. **Updated README**: `README.md` (current features + links)

6. **Documentation Review Report**: `docs/DOCUMENTATION_REVIEW_REPORT.md` with:
   - Gaps found and filled
   - Documentation quality metrics
   - Recommendations for future improvements

7. **TESTING_LOG.md Update**: [TEST-DOC-001] with review status

## Constraints

**❌ DO NOT**:
- Copy outdated examples from old documentation
- Use technical jargon in user guides (write for non-technical audience)
- Skip screenshots (visual aids critical for users)
- Forget to update version numbers

**✅ DO**:
- Test all code examples before including
- Use clear, simple language
- Include screenshots for complex workflows
- Cross-reference related documentation

## Verification Questions

1. **API Completeness**: Are all new endpoints documented? (Check: API_REFERENCE.md has POST /api/users/{id}/permissions)
2. **User Guide Usability**: Can non-technical user follow instructions? (Test: give guide to non-developer)
3. **Example Accuracy**: Do all code examples work? (Test: copy-paste into Postman)
4. **Screenshot Currency**: Do screenshots match current UI? (Check: compare with live app)
5. **Cross-References**: Do all internal links work? (Test: click every link)
6. **README Accuracy**: Does README reflect current features? (Check: Multi-Tenant Access Control listed)

---

# Summary

**8 Complete Prompt Bundles** for Phase 10 remaining tasks:

**Security (2 bundles)**:
- 10A.5: JWT Tampering Testing (ai-security-red-teamer)
- 10A.6: Rate Limiting Bypass Testing (ai-security-red-teamer)

**QA (6 bundles)**:
- 10B.1: Integration Test Suite (sdet-test-automation) - 171+ tests
- 10B.2: E2E Permission Workflow Tests (sdet-test-automation)
- 10B.3: Load Testing (sdet-test-automation) - 1000 concurrent users
- 10B.4: Performance Benchmarking (sdet-test-automation) - <50ms overhead
- 10B.5: Accessibility Compliance Testing (design-review) - WCAG AA
- 10B.6: Documentation Review (documentation-synthesizer)

**Total Estimated Effort**: ~90 hours across 8 tasks

**Success Criteria**:
- All tests passing (171+ integration, 30+ E2E, 10+ load tests)
- >80% code coverage
- <50ms authorization overhead
- WCAG 2.1 AA compliance
- Complete documentation (API, User Guide, Admin Manual)

---

**Document Version**: 1.0
**Generated**: 2025-11-27
**Source**: ADR-005-TEST_PLAN.md, ADR-005-UX_SPEC.md, DOCUMENTATION_STANDARDS.md

---

# 🎉 All Prompt Bundles Complete

**Total Tasks**: 31 | **Total Phases**: 5 (6-10) | **Status**: ✅ Ready for Execution

