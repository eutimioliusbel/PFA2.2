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
