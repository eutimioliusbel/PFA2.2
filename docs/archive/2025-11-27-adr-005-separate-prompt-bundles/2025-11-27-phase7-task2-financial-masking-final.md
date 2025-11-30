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
