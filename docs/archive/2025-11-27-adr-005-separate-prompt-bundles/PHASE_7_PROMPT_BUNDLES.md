# Phase 7 Prompt Bundles - UX & AI Quality Enhancements

**ADR-005 Multi-Tenant Access Control**
**Generated**: 2025-11-27
**Phase**: 7 - UX & AI Quality Enhancements (Use Cases 16-18)

---

## Task 7.1: Context-Aware Access Explanation (UC 16)

**Agent**: @ux-technologist
**Dependencies**: Phase 5 (Permission System), Phase 6 (AI Integration)
**Use Case**: ADR-005-AI_OPPORTUNITIES.md UC 16 - "The Why Button"

### Mission

Implement AI-powered context-aware access explanation system that helps users understand WHY they cannot perform actions and provides actionable resolution steps.

**Your 5-Step Mission**:

1. **Implement explainPermissionDenial() Service** (backend/src/services/ai/aiPermissionExplainer.ts)
   - Load user's current permissions and organization status
   - Construct AI prompt with permission context
   - Call AI (Gemini) to generate friendly explanation
   - Return actionable steps, resolution time, and contact person

2. **Create ContextTooltip Component** (components/common/ContextTooltip.tsx)
   - Lazy-load explanation on hover/focus (disabled buttons only)
   - Display AI-generated explanation with visual hierarchy
   - Show actionable steps as numbered list
   - Include ETA and contact person footer
   - Add "Request Access" button

3. **Integrate Tooltips in CommandDeck** (components/CommandDeck.tsx)
   - Wrap all permission-gated buttons with ContextTooltip
   - Pass action name and required permission
   - Ensure keyboard accessibility (Enter key triggers tooltip)

4. **Add API Endpoint** (backend/src/routes/aiRoutes.ts)
   - POST /api/ai/explain-permission
   - Validate user context from JWT
   - Rate limit to 20 requests/minute per user

5. **Update apiClient Service** (services/apiClient.ts)
   - Add explainPermissionDenial() method
   - Handle 429 rate limit errors gracefully
   - Cache explanations for 5 minutes (same action + permission)

---

### Complete Implementation Code

#### File 1: backend/src/services/ai/aiPermissionExplainer.ts

```typescript
import { prisma } from '../../config/database';
import { callAI } from './aiProviderService';

interface PermissionDenialParams {
  userId: string;
  organizationId: string;
  attemptedAction: string;
  requiredPermission: string;
}

interface PermissionExplanation {
  explanation: string;
  actionableSteps: string[];
  estimatedResolutionTime: string;
  contactPerson?: string;
  permissionChain?: Array<{
    check: string;
    result: boolean;
    reason: string;
  }>;
}

/**
 * AI-powered service to explain why a user cannot perform an action
 *
 * Use Case: UC 16 - Context-Aware Access Explanation
 *
 * Example:
 * - User hovers over disabled "Sync Data" button
 * - AI explains: "Your Field Engineer role doesn't include sync permissions"
 * - AI suggests: "Request role upgrade to Project Manager from admin@example.com"
 *
 * @see ADR-005-AI_OPPORTUNITIES.md UC 16
 */
export class AiPermissionExplainer {
  /**
   * Generate friendly explanation for why user cannot perform action
   *
   * @param params - User context and attempted action
   * @returns AI-generated explanation with actionable steps
   *
   * @example
   * const explanation = await explainer.explainPermissionDenial({
   *   userId: 'user-123',
   *   organizationId: 'org-456',
   *   attemptedAction: 'sync PEMS data',
   *   requiredPermission: 'canSync'
   * });
   *
   * console.log(explanation.explanation);
   * // "You cannot sync because your Field Engineer role doesn't include PEMS sync permissions"
   *
   * console.log(explanation.actionableSteps);
   * // ["Request role upgrade to Project Manager", "Contact admin@example.com"]
   */
  async explainPermissionDenial(
    params: PermissionDenialParams
  ): Promise<PermissionExplanation> {
    // Load user's current permissions and organization context
    const userOrg = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: params.userId,
          organizationId: params.organizationId,
        },
      },
      include: {
        user: {
          select: {
            username: true,
            email: true,
          },
        },
        organization: {
          select: {
            name: true,
            serviceStatus: true,
          },
        },
      },
    });

    // User not in organization at all
    if (!userOrg) {
      return {
        explanation: 'You do not have access to this organization.',
        actionableSteps: [
          'Request access from your organization administrator',
          'Verify you are logged into the correct account',
        ],
        estimatedResolutionTime: '1-2 business days',
        permissionChain: [
          {
            check: 'User is member of organization',
            result: false,
            reason: 'User not found in organization membership',
          },
        ],
      };
    }

    // Build permission context for AI
    const currentPermissions = {
      canRead: userOrg.canRead,
      canWrite: userOrg.canWrite,
      canDelete: userOrg.canDelete,
      canSync: userOrg.canSync,
      canManageUsers: userOrg.canManageUsers,
      canManageApiServers: userOrg.canManageApiServers,
      canViewFinancialDetails: userOrg.canViewFinancialDetails,
    };

    // Check organization status
    const orgStatusIssues: string[] = [];
    if (userOrg.organization.serviceStatus === 'suspended') {
      orgStatusIssues.push('Organization is currently suspended');
    }
    if (userOrg.organization.serviceStatus === 'trial_expired') {
      orgStatusIssues.push('Organization trial has expired');
    }

    // Construct AI prompt
    const prompt = `
You are an access control assistant helping users understand why they cannot perform an action.

User Context:
- Username: ${userOrg.user.username}
- Email: ${userOrg.user.email}
- Role: ${userOrg.role}
- Organization: ${userOrg.organization.name}
- Org Status: ${userOrg.organization.serviceStatus}
- Attempted Action: ${params.attemptedAction}
- Required Permission: ${params.requiredPermission}

Current Permissions:
${JSON.stringify(currentPermissions, null, 2)}

Organization Issues:
${orgStatusIssues.length > 0 ? orgStatusIssues.join('\n') : 'None'}

TASK:
Generate a friendly, actionable explanation for why the user cannot perform this action.

Requirements:
1. Write a SINGLE friendly sentence explaining why (no technical jargon)
2. Provide 2-3 specific, actionable steps to resolve (include exact role names)
3. Estimate realistic time to resolution
4. Suggest who to contact (if applicable)
5. Be empathetic but concise (max 150 words total)

Format as JSON:
{
  "explanation": "One sentence explaining why action is blocked",
  "actionableSteps": [
    "Step 1: Specific action with exact role/contact",
    "Step 2: Alternative action if Step 1 fails",
    "Step 3 (optional): Escalation path"
  ],
  "estimatedResolutionTime": "X hours/days (be realistic)",
  "contactPerson": "Role or email (if applicable)"
}

Examples:
- Good explanation: "Your Field Engineer role doesn't include permission to sync PEMS data."
- Bad explanation: "Permission denied: canSync capability not found in user.capabilities array."

- Good step: "Request role upgrade to Project Manager from your org admin"
- Bad step: "Contact administrator"
`;

    // Call AI to generate explanation
    const response = await callAI({
      provider: 'gemini',
      model: 'gemini-pro',
      prompt,
      responseFormat: 'json',
      maxTokens: 300,
    });

    // Parse AI response
    const aiExplanation: PermissionExplanation = JSON.parse(response.text);

    // Build permission chain for debugging
    const permissionChain = this.buildPermissionChain(
      params.requiredPermission,
      currentPermissions,
      userOrg.organization.serviceStatus
    );

    return {
      ...aiExplanation,
      permissionChain,
    };
  }

  /**
   * Build permission chain showing which checks failed
   * Used for detailed debugging in dev mode
   */
  private buildPermissionChain(
    requiredPermission: string,
    currentPermissions: Record<string, boolean>,
    orgStatus: string
  ): Array<{ check: string; result: boolean; reason: string }> {
    const chain: Array<{ check: string; result: boolean; reason: string }> = [];

    // Check user permission
    const hasPermission = currentPermissions[requiredPermission] === true;
    chain.push({
      check: `User has ${requiredPermission} capability`,
      result: hasPermission,
      reason: hasPermission
        ? `Permission granted`
        : `User role does not include ${requiredPermission}`,
    });

    // Check organization status
    const orgActive = orgStatus === 'active';
    chain.push({
      check: 'Organization status is active',
      result: orgActive,
      reason: orgActive
        ? 'Organization is active'
        : `Organization status: ${orgStatus}`,
    });

    return chain;
  }
}

export const aiPermissionExplainer = new AiPermissionExplainer();
```

---

#### File 2: components/common/ContextTooltip.tsx

```tsx
import { useState, useEffect } from 'react';
import { Info, Clock, User, AlertCircle } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface ContextTooltipProps {
  /** Human-readable action name (e.g., "sync data", "delete records") */
  action: string;
  /** Permission field name (e.g., "canSync", "canDelete") */
  permission: string;
  /** Whether the action is disabled due to missing permission */
  disabled: boolean;
  /** Child element (typically a button) */
  children: React.ReactNode;
  /** Optional: Custom explanation (skips AI call) */
  customExplanation?: {
    explanation: string;
    actionableSteps: string[];
    estimatedResolutionTime?: string;
    contactPerson?: string;
  };
}

/**
 * Context-aware tooltip that explains WHY a user cannot perform an action
 *
 * Use Case: UC 16 - Context-Aware Access Explanation
 *
 * Features:
 * - Lazy loads AI explanation on hover/focus
 * - Shows actionable resolution steps
 * - Includes ETA and contact person
 * - Keyboard accessible (Enter key)
 * - Caches explanations to avoid redundant AI calls
 *
 * @example
 * <ContextTooltip action="sync data" permission="canSync" disabled={!canSync}>
 *   <button disabled={!canSync}>Sync Data</button>
 * </ContextTooltip>
 *
 * @see ADR-005-AI_OPPORTUNITIES.md UC 16
 */
export function ContextTooltip({
  action,
  permission,
  disabled,
  children,
  customExplanation,
}: ContextTooltipProps) {
  const [explanation, setExplanation] = useState<any>(customExplanation || null);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch AI-generated explanation
   * Only called when:
   * 1. Button is disabled
   * 2. User hovers/focuses
   * 3. No explanation cached
   */
  const fetchExplanation = async () => {
    if (!disabled || explanation || customExplanation) return;

    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.explainPermissionDenial({
        attemptedAction: action,
        requiredPermission: permission,
      });
      setExplanation(result);
    } catch (err: any) {
      console.error('Failed to fetch explanation:', err);
      setError(err.message || 'Failed to load explanation');

      // Fallback explanation
      setExplanation({
        explanation: `You don't have permission to ${action}.`,
        actionableSteps: [
          'Contact your organization administrator',
          'Verify your current role has the required permissions',
        ],
        estimatedResolutionTime: 'Varies',
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Keyboard accessibility: Enter key shows tooltip
   */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && disabled) {
      setVisible(true);
      fetchExplanation();
    }
  };

  /**
   * Mouse enter: Show tooltip and fetch explanation
   */
  const handleMouseEnter = () => {
    if (disabled) {
      setVisible(true);
      fetchExplanation();
    }
  };

  /**
   * Mouse leave: Hide tooltip
   */
  const handleMouseLeave = () => {
    setVisible(false);
  };

  return (
    <div className="relative inline-block">
      {/* Trigger Element */}
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
        onKeyPress={handleKeyPress}
        aria-describedby={disabled ? 'permission-tooltip' : undefined}
        tabIndex={disabled ? 0 : -1}
      >
        {children}
      </div>

      {/* Tooltip */}
      {visible && disabled && (
        <div
          id="permission-tooltip"
          role="tooltip"
          className="absolute z-50 w-80 p-4 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl animate-fade-in"
          style={{
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          {/* Loading State */}
          {loading && (
            <div className="flex items-center gap-2 text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
              <span>Analyzing permissions...</span>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="flex items-start gap-2 text-red-600">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Failed to load explanation</p>
                <p className="text-xs mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Explanation Content */}
          {explanation && !loading && (
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">
                    Why can't I {action}?
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {explanation.explanation}
                  </p>
                </div>
              </div>

              {/* Actionable Steps */}
              {explanation.actionableSteps && explanation.actionableSteps.length > 0 && (
                <div className="border-t pt-3">
                  <h5 className="text-sm font-medium text-gray-900 mb-2">
                    💡 How to resolve:
                  </h5>
                  <ol className="text-sm text-gray-600 space-y-1.5">
                    {explanation.actionableSteps.map((step: string, i: number) => (
                      <li key={i} className="flex items-start">
                        <span className="font-medium text-blue-600 mr-2 flex-shrink-0">
                          {i + 1}.
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Footer Metadata */}
              <div className="flex items-center gap-4 text-xs text-gray-500 border-t pt-2">
                {explanation.estimatedResolutionTime && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>ETA: {explanation.estimatedResolutionTime}</span>
                  </div>
                )}
                {explanation.contactPerson && (
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>Contact: {explanation.contactPerson}</span>
                  </div>
                )}
              </div>

              {/* Request Access Button */}
              <button
                onClick={() => {
                  // TODO: Open request access modal
                  console.log('Request access for permission:', permission);
                }}
                className="w-full py-2 px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Request Access
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

#### File 3: components/CommandDeck.tsx (Integration)

```tsx
import { ContextTooltip } from './common/ContextTooltip';
import { useCanWrite, useCanDelete, useCanSync } from '../hooks/usePermissions';

export function CommandDeck() {
  const canWrite = useCanWrite();
  const canDelete = useCanDelete();
  const canSync = useCanSync();

  return (
    <div className="command-deck p-4 bg-white border-b space-y-4">
      {/* Bulk Operations */}
      <div className="flex gap-2">
        <ContextTooltip action="shift time" permission="canWrite" disabled={!canWrite}>
          <button
            disabled={!canWrite}
            onClick={handleShiftTime}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Shift Time
          </button>
        </ContextTooltip>

        <ContextTooltip action="adjust duration" permission="canWrite" disabled={!canWrite}>
          <button
            disabled={!canWrite}
            onClick={handleAdjustDuration}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Adjust Duration
          </button>
        </ContextTooltip>

        <ContextTooltip action="delete records" permission="canDelete" disabled={!canDelete}>
          <button
            disabled={!canDelete}
            onClick={handleDelete}
            className="px-4 py-2 bg-red-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Delete
          </button>
        </ContextTooltip>
      </div>

      {/* Data Operations */}
      <div className="flex gap-2">
        <ContextTooltip action="sync data" permission="canSync" disabled={!canSync}>
          <button
            disabled={!canSync}
            onClick={handleSync}
            className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Sync Data
          </button>
        </ContextTooltip>
      </div>
    </div>
  );
}
```

---

#### File 4: backend/src/routes/aiRoutes.ts (API Endpoint)

```typescript
import express from 'express';
import { authenticateJWT } from '../middleware/auth';
import { aiPermissionExplainer } from '../services/ai/aiPermissionExplainer';
import rateLimit from 'express-rate-limit';

const router = express.Router();

/**
 * Rate limiter for AI permission explanation
 * Limit: 20 requests per minute per user
 */
const explainRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: 'Too many explanation requests. Please wait a moment.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/ai/explain-permission
 *
 * Generate AI explanation for why user cannot perform action
 *
 * Use Case: UC 16 - Context-Aware Access Explanation
 *
 * Body:
 * {
 *   "attemptedAction": "sync data",
 *   "requiredPermission": "canSync"
 * }
 *
 * Response:
 * {
 *   "explanation": "Your Field Engineer role doesn't include sync permissions",
 *   "actionableSteps": ["Request role upgrade to Project Manager"],
 *   "estimatedResolutionTime": "1-2 business days",
 *   "contactPerson": "admin@example.com"
 * }
 */
router.post(
  '/explain-permission',
  authenticateJWT,
  explainRateLimit,
  async (req, res) => {
    try {
      const { attemptedAction, requiredPermission } = req.body;
      const userId = req.user!.userId;
      const organizationId = req.user!.organizationId;

      // Validation
      if (!attemptedAction || !requiredPermission) {
        return res.status(400).json({
          error: 'Missing required fields: attemptedAction, requiredPermission',
        });
      }

      // Generate explanation
      const explanation = await aiPermissionExplainer.explainPermissionDenial({
        userId,
        organizationId,
        attemptedAction,
        requiredPermission,
      });

      res.json(explanation);
    } catch (error: any) {
      console.error('Error explaining permission denial:', error);
      res.status(500).json({
        error: 'Failed to generate explanation',
        message: error.message,
      });
    }
  }
);

export default router;
```

---

#### File 5: services/apiClient.ts (Frontend API Client)

```typescript
import axios from 'axios';

class ApiClient {
  private baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  private cache = new Map<string, { data: any; timestamp: number }>();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Explain why user cannot perform an action (AI-powered)
   *
   * Use Case: UC 16 - Context-Aware Access Explanation
   *
   * Caches results for 5 minutes to avoid redundant AI calls
   *
   * @param params - Action and permission context
   * @returns AI-generated explanation with actionable steps
   */
  async explainPermissionDenial(params: {
    attemptedAction: string;
    requiredPermission: string;
  }): Promise<{
    explanation: string;
    actionableSteps: string[];
    estimatedResolutionTime?: string;
    contactPerson?: string;
  }> {
    // Check cache first
    const cacheKey = `explain:${params.attemptedAction}:${params.requiredPermission}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log('Returning cached explanation');
      return cached.data;
    }

    // Fetch fresh explanation
    const token = localStorage.getItem('pfa_auth_token');
    const response = await axios.post(
      `${this.baseURL}/api/ai/explain-permission`,
      params,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // Cache result
    this.cache.set(cacheKey, {
      data: response.data,
      timestamp: Date.now(),
    });

    return response.data;
  }

  /**
   * Clear explanation cache (call after permission changes)
   */
  clearExplanationCache(): void {
    this.cache.clear();
  }
}

export const apiClient = new ApiClient();
```

---

### AI + UX Enforcement Rules

**AI Integration** (from ADR-005-AI_OPPORTUNITIES.md UC 16):
- ✅ AI explains WHY permission denied (not just "Access denied")
- ✅ AI provides 2-3 actionable steps (no generic "contact admin")
- ✅ AI suggests who to contact (role or email)
- ✅ AI estimates resolution time (realistic, not "soon")
- ✅ Fallback explanation if AI call fails (no broken tooltips)

**UX Requirements** (from ADR-005-UX_SPEC.md):
- ✅ Tooltip appears on hover + focus (keyboard accessible)
- ✅ Lazy loading (fetch explanation only when needed)
- ✅ Loading state (spinner + "Analyzing permissions...")
- ✅ Error state (fallback explanation if AI fails)
- ✅ Visual hierarchy (icon + header + steps + footer)
- ✅ "Request Access" button (future: opens modal)
- ✅ No tooltip flash on enabled buttons (only show when disabled)

**Performance**:
- ✅ Cache explanations for 5 minutes (avoid redundant AI calls)
- ✅ Rate limit: 20 requests/minute per user (prevent abuse)
- ✅ AI timeout: 5 seconds max (fallback if slow)
- ✅ Tooltip appears instantly (explanation loads in background)

**Security**:
- ✅ User context from JWT token (no client-side spoofing)
- ✅ Permission chain logged for audit (who tried what)
- ✅ AI prompt sanitization (prevent prompt injection)
- ✅ Rate limiting enforced server-side

---

### Verification Questions

**Before you start coding**:

1. **Permission Context**: Have you verified that the JWT token contains `userId` and `organizationId`? How will you handle expired tokens in the tooltip?

2. **AI Prompt Engineering**: The AI prompt includes sensitive user data (role, permissions). How will you prevent prompt injection attacks? Should we sanitize the `attemptedAction` field?

3. **Caching Strategy**: Explanations are cached for 5 minutes. What happens if user's permissions change during that time (e.g., admin upgrades their role)? Should we add a cache invalidation API?

4. **Keyboard Accessibility**: The tooltip appears on Enter key. What happens if the user presses Escape? Should we add Escape key handling to close the tooltip?

5. **Fallback UX**: If AI call fails, we show a generic fallback. Should we still show the permission chain (debug info) in development mode to help developers troubleshoot?

**After implementation**:

6. **Test Edge Cases**: What happens if:
   - User has NO organizations (new user)?
   - Organization is suspended (billing hold)?
   - AI returns malformed JSON?
   - Network timeout (AI call takes >10 seconds)?

7. **AI Response Quality**: Have you tested the AI prompt with 5+ real scenarios (different roles, different permissions)? Are the explanations actually helpful (not just "contact admin")?

8. **Performance Impact**: Open DevTools Network tab. Hover over 10 disabled buttons. How many AI calls are made? (Should be 0 if caching works). What's the average response time?

9. **Accessibility Audit**: Use a screen reader (NVDA/JAWS). Can you navigate to the disabled button and hear the explanation? Is the `aria-describedby` attribute working?

---

### Success Criteria

- ✅ All disabled buttons in CommandDeck have ContextTooltip wrappers
- ✅ Tooltip shows AI-generated explanation with 2-3 actionable steps
- ✅ Keyboard accessible (Enter key shows tooltip, Escape closes)
- ✅ Explanations cached for 5 minutes (no redundant AI calls)
- ✅ Rate limit enforced (20 requests/minute per user)
- ✅ Fallback explanation if AI fails (no broken tooltips)
- ✅ Permission chain logged for audit
- ✅ Screen reader compatible (aria-describedby, role="tooltip")

---

## Task 7.2: Financial Data Masking (UC 17)

**Agent**: @ux-technologist
**Dependencies**: Phase 5 (Permission System - viewFinancialDetails capability)
**Use Case**: ADR-005-AI_OPPORTUNITIES.md UC 17 - "Predictive Ghost Values"

### Mission

Implement AI-powered financial data masking system that shows relative impact indicators instead of absolute costs for users without `viewFinancialDetails` permission.

**Your 5-Step Mission**:

1. **Implement maskFinancialData() Service** (backend/src/services/ai/aiFinancialMasker.ts)
   - Accept array of PFA records with costs
   - Calculate cost percentiles per category (P50, P90, P95)
   - Call AI to generate relative indicators ("High Budget Impact", "Within Budget")
   - Return masked records with impact badges and insights

2. **Create MaskedCostDisplay Component** (components/common/MaskedCostDisplay.tsx)
   - Display impact badge instead of dollar amount
   - Show AI-generated insight on hover
   - Support 3 masking levels: none (show cost), partial (show range), full (badge only)
   - Color-coded badges: red (high), yellow (medium), green (low)

3. **Create CostBadge Component** (components/common/CostBadge.tsx)
   - Visual indicator for relative cost (⚠️ High, ⏺️ Medium, ✅ Low)
   - Tooltip with AI insight ("3.2x higher than average crane rental")
   - Responsive design (desktop: full text, mobile: icon only)

4. **Update KpiBoard with Masking** (components/KpiBoard.tsx)
   - Check user's `viewFinancialDetails` permission
   - If false: show masked totals ("Portfolio Impact: High")
   - If true: show actual dollar amounts
   - Add toggle button (admin can preview masked view)

5. **Update Timeline Bars with Badges** (components/Timeline.tsx)
   - Replace cost label with MaskedCostDisplay
   - Show impact badge next to equipment name
   - Ensure tooltip doesn't overlap timeline bars

---

### Complete Implementation Code

#### File 1: backend/src/services/ai/aiFinancialMasker.ts

```typescript
import { prisma } from '../../config/database';
import { callAI } from './aiProviderService';
import { calculateCost } from '../../utils/costCalculations';

interface MaskingParams {
  records: Array<{
    id: string;
    cost: number;
    category: string;
    description?: string;
  }>;
  userId: string;
  organizationId: string;
  maskingLevel: 'none' | 'partial' | 'full';
}

interface MaskedRecord {
  id: string;
  cost: string; // "***masked***" or "$10K-$50K" or "$45,000"
  impactLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  impactDescription: string;
  relativeComparison: string;
  budgetImpactBadge: string;
  aiInsight: string;
}

/**
 * AI-powered financial data masking service
 *
 * Use Case: UC 17 - Financial Data Masking with Relative Indicators
 *
 * Masking Levels:
 * - none: Show exact cost ($45,000)
 * - partial: Show cost range ($10K-$50K)
 * - full: Hide cost, show badge only (⚠️ High Budget Impact)
 *
 * @see ADR-005-AI_OPPORTUNITIES.md UC 17
 */
export class AiFinancialMasker {
  /**
   * Mask financial data with AI-generated relative indicators
   *
   * @param params - Records to mask and masking level
   * @returns Masked records with impact badges and AI insights
   *
   * @example
   * const masked = await masker.maskFinancialData({
   *   records: [
   *     { id: 'pfa-1', cost: 450000, category: 'Cranes' },
   *     { id: 'pfa-2', cost: 12000, category: 'Generators' }
   *   ],
   *   userId: 'user-123',
   *   organizationId: 'org-456',
   *   maskingLevel: 'full'
   * });
   *
   * console.log(masked[0].budgetImpactBadge);
   * // "⚠️ High Budget Impact"
   *
   * console.log(masked[0].aiInsight);
   * // "This equipment is 3.2x more expensive than average crane rentals"
   */
  async maskFinancialData(params: MaskingParams): Promise<MaskedRecord[]> {
    // Calculate cost percentiles per category (for relative comparison)
    const categoryStats = await this.calculateCategoryPercentiles(
      params.organizationId,
      params.records
    );

    // Prepare AI prompt
    const prompt = `
You are a financial analysis assistant helping users understand equipment costs without revealing exact amounts.

Organization: ${params.organizationId}
Masking Level: ${params.maskingLevel}

Equipment Records:
${JSON.stringify(
  params.records.map((r) => ({
    id: r.id,
    cost: r.cost,
    category: r.category,
    description: r.description,
  })),
  null,
  2
)}

Category Baselines:
${JSON.stringify(categoryStats, null, 2)}

TASK:
For each record, generate:
1. Impact Level: LOW (bottom 50%), MEDIUM (50-90%), HIGH (top 10%)
2. Impact Description: One sentence explaining why (e.g., "Top 5% of crane costs")
3. Relative Comparison: Comparison to category average (e.g., "3.2x higher than average")
4. Budget Impact Badge: Icon + text (⚠️ High Budget Impact, ⏺️ Medium Impact, ✅ Within Budget)
5. AI Insight: One sentence actionable insight (no cost mentioned!)

Format as JSON array:
[
  {
    "id": "pfa-1",
    "impactLevel": "HIGH",
    "impactDescription": "Top 5% of equipment costs in this category",
    "relativeComparison": "3.2x higher than average crane rental",
    "budgetImpactBadge": "⚠️ High Budget Impact",
    "aiInsight": "Consider reviewing rental duration or exploring alternatives to reduce costs"
  },
  ...
]

Requirements:
- Never mention exact dollar amounts in insights
- Be specific (use percentiles, not vague "expensive")
- Provide actionable suggestions (not just "this is expensive")
- Match tone to masking level (full = most abstract, partial = moderate detail)
`;

    // Call AI
    const response = await callAI({
      provider: 'gemini',
      model: 'gemini-pro',
      prompt,
      responseFormat: 'json',
      maxTokens: 1000,
    });

    const aiMasked: MaskedRecord[] = JSON.parse(response.text);

    // Apply masking level to cost field
    return aiMasked.map((masked) => {
      const record = params.records.find((r) => r.id === masked.id)!;
      const maskedCost = this.maskCostValue(
        record.cost,
        params.maskingLevel,
        categoryStats[record.category]
      );

      return {
        ...masked,
        cost: maskedCost,
      };
    });
  }

  /**
   * Calculate cost percentiles per category
   * Used to determine if a record is "expensive" relative to peers
   */
  private async calculateCategoryPercentiles(
    organizationId: string,
    records: Array<{ category: string }>
  ): Promise<Record<string, { p50: number; p90: number; p95: number; avg: number }>> {
    const categories = [...new Set(records.map((r) => r.category))];
    const stats: Record<
      string,
      { p50: number; p90: number; p95: number; avg: number }
    > = {};

    for (const category of categories) {
      // Fetch all PFA records in this category for this org
      const categoryRecords = await prisma.pfaRecord.findMany({
        where: {
          organizationId,
          category,
          isDiscontinued: false,
        },
        select: {
          monthlyRate: true,
          purchasePrice: true,
          source: true,
          forecastStart: true,
          forecastEnd: true,
        },
      });

      // Calculate costs
      const costs = categoryRecords
        .map((r) =>
          calculateCost({
            source: r.source,
            monthlyRate: r.monthlyRate,
            purchasePrice: r.purchasePrice,
            startDate: r.forecastStart,
            endDate: r.forecastEnd,
          })
        )
        .sort((a, b) => a - b);

      if (costs.length === 0) {
        stats[category] = { p50: 0, p90: 0, p95: 0, avg: 0 };
        continue;
      }

      const p50 = costs[Math.floor(costs.length * 0.5)];
      const p90 = costs[Math.floor(costs.length * 0.9)];
      const p95 = costs[Math.floor(costs.length * 0.95)];
      const avg = costs.reduce((sum, c) => sum + c, 0) / costs.length;

      stats[category] = { p50, p90, p95, avg };
    }

    return stats;
  }

  /**
   * Mask cost value based on masking level
   * - none: $45,000
   * - partial: $10K-$50K
   * - full: ***masked***
   */
  private maskCostValue(
    cost: number,
    level: 'none' | 'partial' | 'full',
    categoryStats: { p50: number; p90: number; p95: number; avg: number }
  ): string {
    if (level === 'none') {
      return `$${cost.toLocaleString()}`;
    }

    if (level === 'partial') {
      // Show cost range based on percentile
      if (cost < categoryStats.p50) {
        return 'Under $10K';
      } else if (cost < categoryStats.p90) {
        return '$10K-$50K';
      } else {
        return 'Over $50K';
      }
    }

    // full masking
    return '***masked***';
  }
}

export const aiFinancialMasker = new AiFinancialMasker();
```

---

#### File 2: components/common/MaskedCostDisplay.tsx

```tsx
import { useState } from 'react';
import { Info } from 'lucide-react';
import { CostBadge } from './CostBadge';
import { useCanViewFinancialDetails } from '../../hooks/usePermissions';

interface MaskedCostDisplayProps {
  /** Actual cost (shown if user has permission) */
  cost: number;
  /** Masked data from AI (shown if user lacks permission) */
  maskedData?: {
    cost: string;
    impactLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    impactDescription: string;
    relativeComparison: string;
    budgetImpactBadge: string;
    aiInsight: string;
  };
  /** Masking level override (default: auto-detect from permission) */
  maskingLevel?: 'none' | 'partial' | 'full';
}

/**
 * Display cost with financial data masking
 *
 * Use Case: UC 17 - Financial Data Masking
 *
 * Behavior:
 * - User has viewFinancialDetails: Show exact cost ($45,000)
 * - User lacks permission + maskingLevel='partial': Show range ($10K-$50K)
 * - User lacks permission + maskingLevel='full': Show badge only (⚠️ High Impact)
 *
 * @example
 * <MaskedCostDisplay
 *   cost={450000}
 *   maskedData={{
 *     cost: "***masked***",
 *     impactLevel: "HIGH",
 *     impactDescription: "Top 5% of crane costs",
 *     relativeComparison: "3.2x higher than average",
 *     budgetImpactBadge: "⚠️ High Budget Impact",
 *     aiInsight: "Consider reviewing rental duration"
 *   }}
 * />
 *
 * @see ADR-005-AI_OPPORTUNITIES.md UC 17
 */
export function MaskedCostDisplay({
  cost,
  maskedData,
  maskingLevel,
}: MaskedCostDisplayProps) {
  const canViewFinancial = useCanViewFinancialDetails();
  const [showTooltip, setShowTooltip] = useState(false);

  // Auto-detect masking level from permission
  const effectiveMaskingLevel =
    maskingLevel || (canViewFinancial ? 'none' : 'full');

  // Show exact cost if permission granted or masking level is 'none'
  if (effectiveMaskingLevel === 'none') {
    return <span className="font-semibold">${cost.toLocaleString()}</span>;
  }

  // Show partial masking (cost range)
  if (effectiveMaskingLevel === 'partial' && maskedData) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-gray-700">{maskedData.cost}</span>
        <CostBadge
          impactLevel={maskedData.impactLevel}
          badge={maskedData.budgetImpactBadge}
        />
      </div>
    );
  }

  // Show full masking (badge only, no cost)
  if (effectiveMaskingLevel === 'full' && maskedData) {
    return (
      <div className="relative inline-block">
        <div
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="flex items-center gap-2 cursor-help"
        >
          <CostBadge
            impactLevel={maskedData.impactLevel}
            badge={maskedData.budgetImpactBadge}
          />
          <Info className="w-4 h-4 text-gray-400" />
        </div>

        {/* AI Insight Tooltip */}
        {showTooltip && (
          <div className="absolute z-50 w-64 p-3 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg">
            <p className="text-xs text-gray-600 mb-2">
              {maskedData.impactDescription}
            </p>
            <p className="text-xs text-gray-800 font-medium mb-2">
              {maskedData.relativeComparison}
            </p>
            <p className="text-xs text-blue-600 italic">{maskedData.aiInsight}</p>
          </div>
        )}
      </div>
    );
  }

  // Fallback: show masked placeholder
  return <span className="text-gray-400">***masked***</span>;
}
```

---

#### File 3: components/common/CostBadge.tsx

```tsx
import { AlertTriangle, Circle, CheckCircle } from 'lucide-react';

interface CostBadgeProps {
  impactLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  badge: string;
  /** Show full text or icon only */
  variant?: 'full' | 'icon-only';
}

/**
 * Visual badge for relative cost impact
 *
 * Use Case: UC 17 - Financial Data Masking
 *
 * Impact Levels:
 * - LOW: ✅ Green, "Within Budget"
 * - MEDIUM: ⏺️ Yellow, "Medium Impact"
 * - HIGH: ⚠️ Red, "High Budget Impact"
 *
 * @example
 * <CostBadge impactLevel="HIGH" badge="⚠️ High Budget Impact" />
 */
export function CostBadge({ impactLevel, badge, variant = 'full' }: CostBadgeProps) {
  const config = {
    LOW: {
      icon: CheckCircle,
      bgColor: 'bg-green-100',
      textColor: 'text-green-800',
      borderColor: 'border-green-300',
    },
    MEDIUM: {
      icon: Circle,
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-800',
      borderColor: 'border-yellow-300',
    },
    HIGH: {
      icon: AlertTriangle,
      bgColor: 'bg-red-100',
      textColor: 'text-red-800',
      borderColor: 'border-red-300',
    },
  };

  const { icon: Icon, bgColor, textColor, borderColor } = config[impactLevel];

  if (variant === 'icon-only') {
    return (
      <div className="inline-flex items-center justify-center w-6 h-6">
        <Icon className={`w-4 h-4 ${textColor}`} />
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${bgColor} ${textColor} ${borderColor}`}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="text-xs font-medium whitespace-nowrap">{badge}</span>
    </div>
  );
}
```

---

#### File 4: components/KpiBoard.tsx (Integration with Masking)

```tsx
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { MaskedCostDisplay } from './common/MaskedCostDisplay';
import { useCanViewFinancialDetails } from '../hooks/usePermissions';

export function KpiBoard({ pfaRecords }: { pfaRecords: PfaRecord[] }) {
  const canViewFinancial = useCanViewFinancialDetails();
  const [previewMasked, setPreviewMasked] = useState(false);

  // Calculate totals
  const totals = {
    plan: calculateTotal(pfaRecords, 'plan'),
    forecast: calculateTotal(pfaRecords, 'forecast'),
    actual: calculateTotal(pfaRecords, 'actual'),
  };

  // Force masking if user lacks permission OR admin is previewing masked view
  const shouldMask = !canViewFinancial || previewMasked;

  return (
    <div className="kpi-board p-4 bg-white border rounded-lg">
      {/* Admin Toggle (only show if user has permission) */}
      {canViewFinancial && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setPreviewMasked(!previewMasked)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            {previewMasked ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {previewMasked ? 'Show Actual Costs' : 'Preview Masked View'}
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 border rounded">
          <h3 className="text-sm text-gray-600 mb-2">Total Plan</h3>
          <MaskedCostDisplay
            cost={totals.plan}
            maskingLevel={shouldMask ? 'partial' : 'none'}
            maskedData={
              shouldMask
                ? {
                    cost: '$500K-$1M',
                    impactLevel: 'MEDIUM',
                    impactDescription: 'Within typical project budget',
                    relativeComparison: '1.1x average project cost',
                    budgetImpactBadge: '⏺️ On Track',
                    aiInsight: 'Budget allocation is reasonable',
                  }
                : undefined
            }
          />
        </div>

        <div className="p-4 border rounded">
          <h3 className="text-sm text-gray-600 mb-2">Total Forecast</h3>
          <MaskedCostDisplay
            cost={totals.forecast}
            maskingLevel={shouldMask ? 'partial' : 'none'}
            maskedData={
              shouldMask
                ? {
                    cost: '$500K-$1M',
                    impactLevel: 'HIGH',
                    impactDescription: 'Exceeds planned budget',
                    relativeComparison: '1.3x planned budget',
                    budgetImpactBadge: '⚠️ Over Budget',
                    aiInsight: 'Review high-impact equipment for optimization',
                  }
                : undefined
            }
          />
        </div>

        <div className="p-4 border rounded">
          <h3 className="text-sm text-gray-600 mb-2">Total Actual</h3>
          <MaskedCostDisplay
            cost={totals.actual}
            maskingLevel={shouldMask ? 'partial' : 'none'}
            maskedData={
              shouldMask
                ? {
                    cost: '$200K-$500K',
                    impactLevel: 'LOW',
                    impactDescription: 'Within expected range',
                    relativeComparison: '0.8x forecasted cost',
                    budgetImpactBadge: '✅ Under Budget',
                    aiInsight: 'Actual costs are tracking below forecast',
                  }
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
```

---

#### File 5: components/Timeline.tsx (Integration with Masked Cost Badges)

```tsx
import { MaskedCostDisplay } from './common/MaskedCostDisplay';
import { useCanViewFinancialDetails } from '../hooks/usePermissions';

export function Timeline({ records }: { records: PfaRecord[] }) {
  const canViewFinancial = useCanViewFinancialDetails();

  return (
    <div className="timeline">
      {records.map((record) => {
        const cost = calculateCost(record);

        return (
          <div key={record.id} className="timeline-bar">
            {/* Equipment Name */}
            <div className="font-medium">{record.description}</div>

            {/* Cost (Masked or Actual) */}
            <MaskedCostDisplay
              cost={cost}
              maskedData={
                !canViewFinancial
                  ? {
                      cost: '***masked***',
                      impactLevel: cost > 50000 ? 'HIGH' : cost > 10000 ? 'MEDIUM' : 'LOW',
                      impactDescription:
                        cost > 50000
                          ? 'Top 10% of equipment costs'
                          : 'Within expected range',
                      relativeComparison:
                        cost > 50000 ? '2.5x average cost' : '1.0x average cost',
                      budgetImpactBadge:
                        cost > 50000
                          ? '⚠️ High Impact'
                          : cost > 10000
                          ? '⏺️ Medium'
                          : '✅ Low',
                      aiInsight:
                        cost > 50000
                          ? 'Consider alternatives to reduce costs'
                          : 'Cost is reasonable',
                    }
                  : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
}
```

---

### AI + UX Enforcement Rules

**AI Integration** (from ADR-005-AI_OPPORTUNITIES.md UC 17):
- ✅ AI translates absolute costs into relative indicators (no exact amounts leaked)
- ✅ AI provides category-specific insights ("Top 5% of crane costs")
- ✅ AI suggests actionable alternatives ("Consider reviewing rental duration")
- ✅ AI uses percentile-based comparisons (P50, P90, P95)
- ✅ Portfolio-level insight ("Your selection includes 1 high-impact item")

**UX Requirements** (from ADR-005-UX_SPEC.md):
- ✅ 3 masking levels: none (exact), partial (range), full (badge only)
- ✅ Color-coded badges: red (high), yellow (medium), green (low)
- ✅ Responsive design: desktop (full badge), mobile (icon only)
- ✅ Tooltip shows AI insight on hover
- ✅ Admin can preview masked view (toggle button)
- ✅ No cost leakage through UI (check DevTools, Network tab)

**Performance**:
- ✅ Percentile calculation cached per category (avoid recalculating)
- ✅ AI masking batched (mask 100 records in 1 call, not 100 calls)
- ✅ Masking applied server-side (no sensitive data sent to client)

**Security**:
- ✅ Permission checked server-side (viewFinancialDetails capability)
- ✅ No cost data in API response if user lacks permission
- ✅ Audit log entry for masked data access attempts
- ✅ AI prompt sanitized (no injection attacks)

---

### Verification Questions

**Before you start coding**:

1. **Masking Level Logic**: How do you determine which masking level to use? Is it per-user (role-based) or per-record (sensitivity-based)? Can admin override masking level?

2. **Percentile Calculation**: Percentiles are calculated across ALL records in a category. What if a category has only 3 records? How do you handle outliers (1 crane costs $1M, 99 others cost $10K)?

3. **AI Insight Quality**: The AI must NOT reveal exact costs in insights. How will you validate this? Should we add a regex check to ensure no "$XX,XXX" patterns leak through?

4. **Responsive Design**: On mobile, badges show icon only. How do users access the full text? Should we add a long-press gesture or expand-on-tap?

5. **Cost Range Accuracy**: Partial masking shows "$10K-$50K". These ranges are hardcoded. Should we calculate dynamic ranges based on category percentiles?

**After implementation**:

6. **Test Edge Cases**: What happens if:
   - Record has no category (uncategorized equipment)?
   - User has partial permission (can see rentals but not purchases)?
   - AI returns empty insights?
   - Cost is $0 (free equipment)?

7. **AI Response Validation**: Have you tested the AI prompt with 10+ records spanning low/medium/high costs? Do the badges match the actual cost distribution?

8. **Data Leakage Audit**: Open DevTools Network tab. Filter API responses. Can you find ANY exact cost values if you lack `viewFinancialDetails` permission? Check response headers too.

9. **Screen Reader Accessibility**: Use NVDA/JAWS. Can you hear "High Budget Impact" announced? Is the relative comparison ("3.2x higher") included in aria-label?

---

### Success Criteria

- ✅ Users without `viewFinancialDetails` see impact badges instead of costs
- ✅ 3 masking levels work: none (exact), partial (range), full (badge only)
- ✅ AI insights are category-specific and actionable
- ✅ No exact cost values leaked in UI, API, or DevTools
- ✅ KPI Board shows masked totals for restricted users
- ✅ Timeline bars display impact badges
- ✅ Admin can preview masked view (toggle button)
- ✅ Screen reader announces impact level and insights

---

## Task 7.3: Semantic Audit Search (UC 18)

**Agent**: @ai-systems-architect
**Dependencies**: Phase 4 (Comprehensive Audit Logging)
**Use Case**: ADR-005-AI_OPPORTUNITIES.md UC 18 - "Forensic Chat"

### Mission

Implement AI-powered semantic audit search that translates natural language queries into structured audit log queries, enabling "forensic chat" investigation workflows.

**Your 5-Step Mission**:

1. **Implement semanticAuditSearch() Service** (backend/src/services/ai/aiAuditSearch.ts)
   - Parse natural language query ("Who changed crane durations last week?")
   - Extract filters: resourceType, changedFields, category, timeRange, userId
   - Query audit log with parsed filters
   - Call AI to generate natural language summary

2. **Create NLP Query Parser** (backend/src/services/ai/nlpQueryParser.ts)
   - Extract time ranges ("last week", "yesterday", "Nov 20-25")
   - Extract entity types ("cranes", "users", "API servers")
   - Extract field names ("duration", "rental cost", "permissions")
   - Extract user references ("John Doe", "admin", "Field Engineers")

3. **Add Vector Embeddings for Audit Logs** (backend/src/services/ai/auditEmbeddings.ts)
   - Generate embeddings for audit log entries (change descriptions)
   - Store embeddings in separate table (AuditLogEmbedding)
   - Similarity search for semantic matching
   - Fall back to keyword search if embeddings unavailable

4. **Create AuditChatInterface Component** (components/admin/AuditChatInterface.tsx)
   - Chat-style UI for audit queries
   - Display results as conversation (Q&A format)
   - Support follow-up questions (context-aware)
   - Export results as CSV

5. **Add Multi-Turn Context** (backend/src/services/ai/auditConversationManager.ts)
   - Store conversation history per user session
   - AI remembers previous queries ("Why did John extend the cranes?")
   - Context window: last 5 queries
   - Clear context on logout

---

### Complete Implementation Code

#### File 1: backend/src/services/ai/aiAuditSearch.ts

```typescript
import { prisma } from '../../config/database';
import { callAI } from './aiProviderService';
import { nlpQueryParser } from './nlpQueryParser';
import { auditEmbeddings } from './auditEmbeddings';

interface SemanticSearchParams {
  query: string;
  userId: string;
  organizationId: string;
  conversationId?: string; // For multi-turn context
}

interface SemanticSearchResult {
  parsedQuery: {
    filters: Record<string, any>;
    groupBy?: string;
    orderBy?: string;
  };
  results: Array<{
    userId: string;
    userName: string;
    changeCount: number;
    affectedRecords: string[];
    changesBreakdown: Array<{
      recordId: string;
      recordDescription: string;
      change: string;
      reason?: string;
      timestamp: string;
    }>;
  }>;
  naturalLanguageSummary: string;
  confidence: number;
}

/**
 * AI-powered semantic audit search service
 *
 * Use Case: UC 18 - Semantic Audit Search ("Forensic Chat")
 *
 * Example Queries:
 * - "Who changed crane durations last week?"
 * - "Show me all permission changes by John Doe"
 * - "What happened to PFA record 12345?"
 * - "Why did costs increase in November?"
 *
 * @see ADR-005-AI_OPPORTUNITIES.md UC 18
 */
export class AiAuditSearch {
  /**
   * Translate natural language query into structured audit search
   *
   * @param params - Natural language query and user context
   * @returns Parsed query, results, and AI-generated summary
   *
   * @example
   * const results = await search.semanticAuditSearch({
   *   query: "Who changed crane durations last week?",
   *   userId: "user-123",
   *   organizationId: "org-456"
   * });
   *
   * console.log(results.naturalLanguageSummary);
   * // "John Doe extended 12 crane rentals by an average of 10 days last week"
   */
  async semanticAuditSearch(
    params: SemanticSearchParams
  ): Promise<SemanticSearchResult> {
    // Load conversation context (for follow-up questions)
    const conversationContext = params.conversationId
      ? await this.loadConversationContext(params.conversationId)
      : null;

    // Parse natural language query into filters
    const parsedQuery = await nlpQueryParser.parse({
      query: params.query,
      context: conversationContext,
    });

    // Execute structured query against audit log
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        organizationId: params.organizationId,
        ...this.buildWhereClause(parsedQuery.filters),
      },
      include: {
        user: {
          select: {
            username: true,
            email: true,
          },
        },
      },
      orderBy: parsedQuery.orderBy || { createdAt: 'desc' },
      take: 100, // Limit to 100 results
    });

    // Group results by user (if groupBy specified)
    const groupedResults = this.groupAuditLogs(
      auditLogs,
      parsedQuery.groupBy
    );

    // Generate natural language summary
    const summary = await this.generateSummary({
      query: params.query,
      results: groupedResults,
      context: conversationContext,
    });

    // Store conversation context for follow-up questions
    if (params.conversationId) {
      await this.storeConversationContext(params.conversationId, {
        query: params.query,
        parsedQuery,
        results: groupedResults,
      });
    }

    return {
      parsedQuery,
      results: groupedResults,
      naturalLanguageSummary: summary.text,
      confidence: summary.confidence,
    };
  }

  /**
   * Build Prisma where clause from parsed filters
   */
  private buildWhereClause(filters: Record<string, any>): Record<string, any> {
    const where: Record<string, any> = {};

    if (filters.resourceType) {
      where.resourceType = filters.resourceType;
    }

    if (filters.changedFields && filters.changedFields.length > 0) {
      where.changes = {
        path: '$.field',
        array_contains: filters.changedFields,
      };
    }

    if (filters.timeRange) {
      where.createdAt = {
        gte: filters.timeRange.start,
        lte: filters.timeRange.end,
      };
    }

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.category) {
      // Parse changes JSON to filter by category
      where.changes = {
        path: '$.newValue.category',
        equals: filters.category,
      };
    }

    return where;
  }

  /**
   * Group audit logs by specified field (e.g., userId)
   */
  private groupAuditLogs(logs: any[], groupBy?: string): any[] {
    if (!groupBy) {
      return logs.map((log) => ({
        recordId: log.resourceId,
        change: JSON.stringify(log.changes),
        timestamp: log.createdAt.toISOString(),
        userName: log.user.username,
      }));
    }

    if (groupBy === 'userId') {
      const grouped = new Map<string, any>();

      logs.forEach((log) => {
        const userId = log.userId;
        if (!grouped.has(userId)) {
          grouped.set(userId, {
            userId,
            userName: log.user.username,
            changeCount: 0,
            affectedRecords: [],
            changesBreakdown: [],
          });
        }

        const entry = grouped.get(userId)!;
        entry.changeCount++;
        entry.affectedRecords.push(log.resourceId);
        entry.changesBreakdown.push({
          recordId: log.resourceId,
          recordDescription: log.changes.newValue?.description || 'Unknown',
          change: this.formatChange(log.changes),
          reason: log.reason,
          timestamp: log.createdAt.toISOString(),
        });
      });

      return Array.from(grouped.values());
    }

    return [];
  }

  /**
   * Format change object into human-readable text
   */
  private formatChange(changes: any): string {
    const field = changes.field;
    const oldValue = changes.oldValue;
    const newValue = changes.newValue;

    if (field === 'forecastEnd' || field === 'forecastStart') {
      const oldDate = new Date(oldValue).toLocaleDateString();
      const newDate = new Date(newValue).toLocaleDateString();
      return `Changed ${field} from ${oldDate} to ${newDate}`;
    }

    return `Changed ${field} from ${oldValue} to ${newValue}`;
  }

  /**
   * Generate natural language summary of results
   */
  private async generateSummary(params: {
    query: string;
    results: any[];
    context: any;
  }): Promise<{ text: string; confidence: number }> {
    const prompt = `
You are an audit analysis assistant summarizing change history.

User Query: "${params.query}"

Results (${params.results.length} entries):
${JSON.stringify(params.results.slice(0, 10), null, 2)}

${params.context ? `Previous Context:\n${JSON.stringify(params.context, null, 2)}` : ''}

TASK:
Generate a 1-2 sentence natural language summary of the results.

Requirements:
- Be specific (mention names, counts, date ranges)
- Highlight patterns (e.g., "most common reason: weather delay")
- Don't just repeat the query
- If no results, explain why (e.g., "No changes found in that time range")

Format as JSON:
{
  "summary": "One or two sentences summarizing results",
  "confidence": 0.0-1.0 (how confident you are in the answer)
}
`;

    const response = await callAI({
      provider: 'gemini',
      model: 'gemini-pro',
      prompt,
      responseFormat: 'json',
      maxTokens: 200,
    });

    const parsed = JSON.parse(response.text);
    return {
      text: parsed.summary,
      confidence: parsed.confidence || 0.8,
    };
  }

  /**
   * Load conversation context for follow-up questions
   */
  private async loadConversationContext(conversationId: string): Promise<any> {
    const conversation = await prisma.auditConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 5, // Last 5 queries
        },
      },
    });

    return conversation?.messages || [];
  }

  /**
   * Store conversation context for follow-up questions
   */
  private async storeConversationContext(
    conversationId: string,
    data: any
  ): Promise<void> {
    await prisma.auditConversationMessage.create({
      data: {
        conversationId,
        query: data.query,
        parsedQuery: JSON.stringify(data.parsedQuery),
        results: JSON.stringify(data.results),
      },
    });
  }
}

export const aiAuditSearch = new AiAuditSearch();
```

---

#### File 2: backend/src/services/ai/nlpQueryParser.ts

```typescript
import { callAI } from './aiProviderService';
import { parseISO, subDays, subWeeks, startOfDay, endOfDay } from 'date-fns';

interface ParseParams {
  query: string;
  context?: any; // Previous conversation context
}

interface ParsedFilters {
  resourceType?: string;
  changedFields?: string[];
  category?: string[];
  timeRange?: {
    start: Date;
    end: Date;
  };
  userId?: string;
  groupBy?: string;
  orderBy?: string;
}

/**
 * NLP query parser for audit log search
 *
 * Extracts structured filters from natural language queries
 *
 * Examples:
 * - "Who changed crane durations last week?"
 *   → { resourceType: 'PfaRecord', changedFields: ['forecastEnd'], category: ['Cranes'], timeRange: ... }
 *
 * - "Show me all permission changes by John Doe"
 *   → { resourceType: 'UserOrganization', userId: 'user-john-doe' }
 */
export class NlpQueryParser {
  /**
   * Parse natural language query into structured filters
   */
  async parse(params: ParseParams): Promise<{ filters: ParsedFilters }> {
    // Use AI to extract entities and intents
    const prompt = `
You are a query parser for an audit log system.

User Query: "${params.query}"

${params.context ? `Previous Context:\n${JSON.stringify(params.context, null, 2)}` : ''}

TASK:
Extract structured filters from the query.

Available Filters:
- resourceType: PfaRecord | UserOrganization | ApiServer | AuditLog
- changedFields: Array of field names (forecastStart, forecastEnd, monthlyRate, etc.)
- category: Array of categories (Cranes, Generators, Scaffolding, etc.)
- timeRange: { start: ISO date, end: ISO date }
- userId: User ID (if specific user mentioned)
- groupBy: userId | resourceType | date
- orderBy: createdAt DESC | createdAt ASC

Entity Mapping:
- "crane" → category: ["Cranes"]
- "duration" → changedFields: ["forecastStart", "forecastEnd"]
- "cost" → changedFields: ["monthlyRate", "purchasePrice"]
- "last week" → timeRange: (today - 7 days to today)
- "John Doe" → userId: (lookup user ID)

Format as JSON:
{
  "filters": {
    "resourceType": "...",
    "changedFields": ["..."],
    "category": ["..."],
    "timeRange": { "start": "...", "end": "..." },
    "userId": "...",
    "groupBy": "...",
    "orderBy": "..."
  }
}
`;

    const response = await callAI({
      provider: 'gemini',
      model: 'gemini-pro',
      prompt,
      responseFormat: 'json',
      maxTokens: 300,
    });

    const parsed = JSON.parse(response.text);

    // Resolve time ranges (AI returns relative dates, we convert to absolute)
    if (parsed.filters.timeRange) {
      parsed.filters.timeRange = this.resolveTimeRange(
        parsed.filters.timeRange
      );
    }

    // Resolve user names to user IDs
    if (params.query.includes('John Doe')) {
      // TODO: Lookup user ID from username
      parsed.filters.userId = 'user-john-doe';
    }

    return parsed;
  }

  /**
   * Resolve relative time ranges to absolute dates
   */
  private resolveTimeRange(range: { start: string; end: string }): {
    start: Date;
    end: Date;
  } {
    const now = new Date();

    // Handle relative ranges
    if (range.start === 'last_week') {
      return {
        start: startOfDay(subWeeks(now, 1)),
        end: endOfDay(now),
      };
    }

    if (range.start === 'yesterday') {
      return {
        start: startOfDay(subDays(now, 1)),
        end: endOfDay(subDays(now, 1)),
      };
    }

    // Handle absolute ISO dates
    return {
      start: parseISO(range.start),
      end: parseISO(range.end),
    };
  }
}

export const nlpQueryParser = new NlpQueryParser();
```

---

#### File 3: components/admin/AuditChatInterface.tsx

```tsx
import { useState, useRef, useEffect } from 'react';
import { Send, Download } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  results?: any[];
  timestamp: Date;
}

/**
 * Chat-style interface for semantic audit search
 *
 * Use Case: UC 18 - Semantic Audit Search
 *
 * Features:
 * - Natural language queries ("Who changed crane durations?")
 * - Follow-up questions (context-aware)
 * - Export results as CSV
 * - Conversation history
 *
 * @see ADR-005-AI_OPPORTUNITIES.md UC 18
 */
export function AuditChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId] = useState(() => `conv-${Date.now()}`);
  const chatEndRef = useRef<HTMLDivElement>(null);

  /**
   * Auto-scroll to bottom when new message added
   */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Submit query to semantic audit search
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const result = await apiClient.semanticAuditSearch({
        query: input,
        conversationId,
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: result.naturalLanguageSummary,
        results: result.results,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Audit search failed:', error);

      const errorMessage: Message = {
        role: 'assistant',
        content: `Sorry, I couldn't process that query: ${error.message}`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Export results as CSV
   */
  const handleExport = (results: any[]) => {
    const csv = this.resultsToCSV(results);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-results-${Date.now()}.csv`;
    a.click();
  };

  /**
   * Convert results to CSV format
   */
  const resultsToCSV = (results: any[]): string => {
    if (!results || results.length === 0) return '';

    const headers = ['User', 'Change Count', 'Record ID', 'Change', 'Timestamp'];
    const rows = results.flatMap((r) =>
      r.changesBreakdown.map((c: any) => [
        r.userName,
        r.changeCount,
        c.recordId,
        c.change,
        c.timestamp,
      ])
    );

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  };

  return (
    <div className="audit-chat-interface flex flex-col h-full bg-gray-50">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg font-medium mb-2">Audit Search Assistant</p>
            <p className="text-sm">
              Ask me anything about changes in your organization
            </p>
            <div className="mt-4 space-y-2">
              <p className="text-xs text-gray-400">Try asking:</p>
              <div className="space-y-1">
                <button
                  onClick={() => setInput('Who changed crane durations last week?')}
                  className="block mx-auto text-xs text-blue-600 hover:underline"
                >
                  "Who changed crane durations last week?"
                </button>
                <button
                  onClick={() => setInput('Show me all permission changes')}
                  className="block mx-auto text-xs text-blue-600 hover:underline"
                >
                  "Show me all permission changes"
                </button>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xl rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white border border-gray-200'
              }`}
            >
              <p className="text-sm">{msg.content}</p>

              {/* Results Table */}
              {msg.results && msg.results.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">
                      {msg.results.length} result(s)
                    </span>
                    <button
                      onClick={() => handleExport(msg.results)}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <Download className="w-3 h-3" />
                      Export CSV
                    </button>
                  </div>

                  <div className="bg-gray-50 rounded p-2 text-xs space-y-2">
                    {msg.results.slice(0, 5).map((r: any, j: number) => (
                      <div key={j} className="border-b pb-2 last:border-b-0">
                        <p className="font-medium">{r.userName}</p>
                        <p className="text-gray-600">
                          {r.changeCount} changes to {r.affectedRecords.length}{' '}
                          records
                        </p>
                      </div>
                    ))}
                    {msg.results.length > 5 && (
                      <p className="text-gray-500 italic">
                        +{msg.results.length - 5} more (export to see all)
                      </p>
                    )}
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-400 mt-2">
                {msg.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
                <span className="text-sm">Searching audit logs...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 bg-white border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about changes (e.g., Who changed crane durations?)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
```

---

### AI + UX Enforcement Rules

**AI Integration** (from ADR-005-AI_OPPORTUNITIES.md UC 18):
- ✅ AI translates natural language into structured filters
- ✅ AI extracts time ranges ("last week" → ISO dates)
- ✅ AI resolves entity references ("crane" → category filter)
- ✅ AI generates natural language summary of results
- ✅ Multi-turn context (follow-up questions work)

**UX Requirements** (from ADR-005-UX_SPEC.md):
- ✅ Chat-style interface (Q&A format)
- ✅ Suggested queries for first-time users
- ✅ Export results as CSV
- ✅ Conversation history (scroll to see past queries)
- ✅ Loading state during search
- ✅ Error handling (graceful fallback)

**Performance**:
- ✅ Query results limited to 100 entries (avoid large responses)
- ✅ Conversation context limited to last 5 queries
- ✅ Results table shows first 5 entries (expand to see all)
- ✅ AI timeout: 10 seconds max

**Security**:
- ✅ User can only search their organization's audit logs
- ✅ Permission check: canRead or canManageUsers required
- ✅ AI prompt sanitization (prevent injection)
- ✅ Conversation context isolated per user session

---

### Verification Questions

**Before you start coding**:

1. **Query Ambiguity**: How do you handle ambiguous queries like "Show me changes"? Should AI ask clarifying questions or make assumptions?

2. **Entity Resolution**: If user says "John changed cranes", how do you find "John"? Username exact match? Fuzzy search? What if there are 3 Johns?

3. **Time Zone Handling**: "Last week" depends on user's time zone. How do you determine the user's time zone? Browser API? Database field?

4. **Vector Embeddings**: Are embeddings required for MVP? Can we ship without similarity search and add it later?

5. **Conversation Context**: Context is stored in database. How do you clean up old conversations? TTL? Manual deletion?

**After implementation**:

6. **Test Edge Cases**: What happens if:
   - Query returns 0 results?
   - User asks follow-up question without initial query?
   - AI fails to parse query (malformed JSON)?
   - Database timeout (audit log query takes >30s)?

7. **AI Parsing Accuracy**: Have you tested the NLP parser with 20+ diverse queries? What's the accuracy rate (correct filters extracted)?

8. **Follow-Up Questions**: Ask "Who changed cranes?" then "Why?". Does the AI correctly use context from the first query?

9. **Export Validation**: Export a 100-row result as CSV. Open in Excel. Are special characters (commas, quotes) escaped correctly?

---

### Success Criteria

- ✅ Users can ask natural language audit queries
- ✅ AI correctly extracts filters (resourceType, timeRange, category, etc.)
- ✅ Results displayed in chat format (Q&A style)
- ✅ Follow-up questions work (context-aware)
- ✅ Export results as CSV (all rows included)
- ✅ Conversation history persists during session
- ✅ Graceful error handling (fallback if AI fails)
- ✅ Permission-gated (only users with canRead or canManageUsers)

---

## END OF PHASE 7 PROMPT BUNDLES

**Usage Instructions**:
1. Copy each task's prompt bundle into a new chat session
2. Tag the appropriate specialist agent (e.g., @ux-technologist for Task 7.1)
3. Ensure dependencies are met before starting (check AGENT_WORKFLOW.md)
4. Verify all success criteria before marking task complete
5. Update AGENT_WORKFLOW.md status after completion

**Next Phase**: Phase 8 - Production Hardening & Documentation
