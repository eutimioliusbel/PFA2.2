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
