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
