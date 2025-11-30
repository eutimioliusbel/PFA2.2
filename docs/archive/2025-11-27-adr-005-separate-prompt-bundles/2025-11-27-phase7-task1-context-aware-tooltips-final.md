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
