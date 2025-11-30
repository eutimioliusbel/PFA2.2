# Vendor Pricing Watchdog API Reference

**Version**: 1.0.0
**Base Path**: `/api/beo/vendor-pricing`
**Authentication**: Required (JWT Bearer Token)
**Authorization**: BEO users with `perm_ViewAllOrgs` capability

---

## Endpoints

### 1. Get Pricing Analysis

Performs comprehensive vendor pricing analysis across all organizations.

**Endpoint**: `GET /api/beo/vendor-pricing/analysis`

**Authorization**: Bearer Token

**Response**: `200 OK`

```json
{
  "success": true,
  "analysis": {
    "marketData": [
      {
        "category": "Cranes",
        "marketAvgRate": 10333.33,
        "vendors": [
          {
            "vendorName": "Acme Rentals",
            "category": "Cranes",
            "avgMonthlyRate": 12000,
            "equipmentCount": 5,
            "organizationIds": ["org-1", "org-2"]
          }
        ]
      }
    ],
    "anomalies": [
      {
        "id": "anomaly-uuid",
        "type": "overpriced",
        "severity": "high",
        "vendorName": "Acme Rentals",
        "category": "Cranes",
        "organizationId": "org-1",
        "currentRate": 12000,
        "marketRate": 10333.33,
        "deviationPercent": 16.1,
        "recommendation": "Acme Rentals is charging 16.1% above market average ($10,333/mo) for Cranes. Consider renegotiating or switching vendors.",
        "status": "active",
        "detectedAt": "2025-11-27T..."
      }
    ],
    "vendorScorecards": [
      {
        "vendorName": "Best Equipment Co",
        "priceCompetitiveness": 0.85,
        "rateStability": 0.92,
        "equipmentCoverage": 0.75,
        "overallScore": 0.84,
        "rank": 1,
        "categories": ["Cranes", "Excavators", "Loaders"]
      }
    ],
    "summary": {
      "totalVendors": 15,
      "totalCategories": 8,
      "anomaliesDetected": 3,
      "avgDeviationPercent": 18.5
    }
  },
  "metadata": {
    "latencyMs": 1234,
    "timestamp": "2025-11-27T15:30:00Z"
  }
}
```

**Error Responses**:

```json
// 401 Unauthorized
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Invalid or missing token"
}

// 403 Forbidden
{
  "success": false,
  "error": "FORBIDDEN",
  "message": "BEO access required (perm_ViewAllOrgs)"
}

// 500 Internal Server Error
{
  "success": false,
  "error": "INTERNAL_ERROR",
  "message": "Failed to analyze vendor pricing"
}
```

---

### 2. Get Active Anomalies

Retrieves all active pricing anomalies.

**Endpoint**: `GET /api/beo/vendor-pricing/anomalies`

**Authorization**: Bearer Token

**Response**: `200 OK`

```json
{
  "success": true,
  "anomalies": [
    {
      "id": "anomaly-uuid",
      "type": "overpriced",
      "severity": "high",
      "vendorName": "Acme Rentals",
      "category": "Cranes",
      "organizationId": "org-1",
      "currentRate": 12000,
      "marketRate": 10333.33,
      "deviationPercent": 16.1,
      "recommendation": "Acme Rentals is charging 16.1% above market average...",
      "status": "active",
      "detectedAt": "2025-11-27T15:00:00Z",
      "resolvedAt": null,
      "resolvedBy": null
    }
  ],
  "count": 1
}
```

---

### 3. Dismiss Anomaly

Dismisses a false positive anomaly.

**Endpoint**: `POST /api/beo/vendor-pricing/dismiss-anomaly/:id`

**Authorization**: Bearer Token

**URL Parameters**:
- `id` (string, required): Anomaly UUID

**Response**: `200 OK`

```json
{
  "success": true,
  "message": "Anomaly dismissed successfully"
}
```

**Error Responses**:

```json
// 400 Bad Request
{
  "success": false,
  "error": "BAD_REQUEST",
  "message": "Anomaly ID is required"
}

// 404 Not Found (anomaly doesn't exist)
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "Anomaly not found"
}
```

---

### 4. Get Vendor Scorecard

Retrieves vendor performance scorecards.

**Endpoint**: `GET /api/beo/vendor-pricing/scorecard`

**Authorization**: Bearer Token

**Response**: `200 OK`

```json
{
  "success": true,
  "scorecards": [
    {
      "vendorName": "Best Equipment Co",
      "priceCompetitiveness": 0.85,
      "rateStability": 0.92,
      "equipmentCoverage": 0.75,
      "overallScore": 0.84,
      "rank": 1,
      "categories": ["Cranes", "Excavators", "Loaders"]
    },
    {
      "vendorName": "Standard Suppliers",
      "priceCompetitiveness": 0.65,
      "rateStability": 0.88,
      "equipmentCoverage": 0.50,
      "overallScore": 0.67,
      "rank": 2,
      "categories": ["Cranes", "Excavators"]
    }
  ],
  "summary": {
    "totalVendors": 15,
    "totalCategories": 8,
    "anomaliesDetected": 3,
    "avgDeviationPercent": 18.5
  }
}
```

---

## Data Models

### PricingAnomaly

```typescript
interface PricingAnomaly {
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
  status: 'active' | 'resolved' | 'dismissed';
  detectedAt: string; // ISO 8601 timestamp
  resolvedAt?: string; // ISO 8601 timestamp
  resolvedBy?: string; // User ID
}
```

### VendorScorecard

```typescript
interface VendorScorecard {
  vendorName: string;
  priceCompetitiveness: number; // 0-1 (1 = best price)
  rateStability: number; // 0-1 (1 = most stable)
  equipmentCoverage: number; // 0-1 (1 = most categories)
  overallScore: number; // Weighted average: 0.40*price + 0.30*stability + 0.30*coverage
  rank: number; // 1 = highest overall score
  categories: string[]; // Equipment categories vendor supplies
}
```

### MarketData

```typescript
interface MarketData {
  category: string;
  marketAvgRate: number;
  vendors: VendorCategoryData[];
}

interface VendorCategoryData {
  vendorName: string;
  category: string;
  avgMonthlyRate: number;
  equipmentCount: number;
  organizationIds: string[];
}
```

---

## Business Logic

### Anomaly Detection

#### Overpriced Threshold
```
deviation = ((vendorRate - marketAvg) / marketAvg) * 100

if (deviation > 15%) {
  severity = deviation > 30% ? 'high' : deviation > 20% ? 'medium' : 'low';
  type = 'overpriced';
}
```

#### Suspicious Increase Threshold
```
increase = ((currentRate - historicalRate) / historicalRate) * 100

if (increase > 10%) {
  severity = increase > 20% ? 'high' : increase > 15% ? 'medium' : 'low';
  type = 'suspicious_increase';
}
```

### Vendor Scorecard Calculation

```
priceCompetitiveness = 1 - (vendorRate / highestRate)
rateStability = 1 - (coefficientOfVariation / 0.1)
equipmentCoverage = vendorCategories.length / totalCategories

overallScore = priceCompetitiveness * 0.40 +
               rateStability * 0.30 +
               equipmentCoverage * 0.30
```

**Ranking**: Vendors sorted by `overallScore` descending (highest score = rank 1)

---

## Examples

### cURL: Get Pricing Analysis

```bash
curl -X GET http://localhost:3001/api/beo/vendor-pricing/analysis \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### cURL: Dismiss Anomaly

```bash
curl -X POST http://localhost:3001/api/beo/vendor-pricing/dismiss-anomaly/anomaly-uuid \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### JavaScript: Fetch Analysis

```javascript
const response = await fetch('/api/beo/vendor-pricing/analysis', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('pfa_auth_token')}`,
  },
});

const data = await response.json();
console.log('Anomalies detected:', data.analysis.summary.anomaliesDetected);
```

---

## Performance Considerations

### Latency Budget
- **Target**: < 2 seconds for full analysis
- **Breakdown**:
  - Database query (rental PFA records): ~800ms
  - Grouping and aggregation: ~300ms
  - Anomaly detection: ~200ms
  - Scorecard calculation: ~150ms

### Optimization Tips
1. **Caching**: Analysis results can be cached for 5-10 minutes
2. **Indexing**: Ensure `(vendorName, category)` index exists on `pfa_records`
3. **Pagination**: For large datasets, consider paginating vendor scorecards
4. **Background Job**: Run `createPricingSnapshot()` daily to avoid expensive historical queries

---

## Error Handling

### Common Errors

1. **No rental records found**
   - Returns empty arrays for `marketData`, `anomalies`, `vendorScorecards`
   - `summary.totalVendors = 0`

2. **Database connection error**
   - Returns `500 Internal Server Error`
   - Check database connection and credentials

3. **Prisma client not generated**
   - Error: `Cannot read properties of undefined (reading 'count')`
   - Solution: Run `npx prisma generate` and restart server

---

## Related Services

### VendorPricingWatchdogService

**File**: `backend/src/services/ai/VendorPricingWatchdogService.ts`

**Public Methods**:
- `analyzeVendorPricing()`: Run full pricing analysis
- `detectAnomalies(marketData)`: Detect pricing anomalies
- `calculateVendorScorecard(marketData)`: Generate vendor scorecards
- `createPricingSnapshot()`: Store historical pricing data
- `persistAnomalies(anomalies)`: Save anomalies to database
- `getActiveAnomalies()`: Retrieve active anomalies
- `dismissAnomaly(anomalyId, userId)`: Dismiss an anomaly

---

## Testing

### Integration Tests

**File**: `backend/tests/integration/vendorPricingWatchdog.test.ts`

**Test Cases**:
1. Overpriced vendor detection (>15% above market)
2. Vendor scorecard ranking (lowest price = highest rank)
3. Month-over-month rate increase detection (>10%)
4. Anomaly persistence to database
5. Anomaly dismissal workflow
6. Pricing snapshot creation
7. Scorecard calculation accuracy
8. Summary statistics validation

### Running Tests

```bash
# Install Jest (if not already installed)
npm install --save-dev jest @types/jest ts-jest

# Run tests
npm test -- vendorPricingWatchdog.test.ts
```

---

## Changelog

### v1.0.0 (2025-11-27)
- Initial release
- Pricing analysis across all organizations
- Anomaly detection (overpriced, suspicious increase)
- Vendor scorecard with rankings
- Dashboard UI with alerts and comparisons
