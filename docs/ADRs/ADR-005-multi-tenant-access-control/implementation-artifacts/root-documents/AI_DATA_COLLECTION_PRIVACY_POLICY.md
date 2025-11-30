# AI Data Collection Privacy Policy

**Phase 6, Task 6.5 of ADR-005 Multi-Tenant Access Control**

**Document Version:** 1.0
**Last Updated:** 2025-11-27
**Status:** ✅ Implemented

---

## Executive Summary

PFA Vanguard collects metadata from user interactions and system operations to train AI models for:

1. **Permission Suggestions** - Recommend appropriate access levels based on role patterns
2. **Anomaly Detection** - Identify unusual behavior that may indicate security threats
3. **Financial Monitoring** - Track access frequency to sensitive financial data
4. **Audit Search** - Enable natural language queries of system activity
5. **Role Drift Detection** - Monitor permission changes over time

**Critical Privacy Principle:** We log **what happened**, **when it happened**, and **who did it** — but **NEVER** log passwords, API keys, actual cost values, or personally identifiable information (PII).

---

## What We Log

### ✅ We DO Log:

| Category | Data Logged | Purpose |
|----------|-------------|---------|
| **Permission Changes** | User ID (not username), permission field name, before/after boolean states, timestamp | AI permission suggestions |
| **External Syncs** | Entity type (User/Organization/PFA), external ID (PEMS ID), sync counts, timestamp | Data lineage tracking |
| **User Activity** | Action type, record count, hour of day, day of week | Anomaly detection baseline |
| **Bulk Operations** | Operation type (export/update/delete), record count, affected fields (names only) | Exfiltration detection |
| **Financial Access** | Access type (view/export/modify), record count, field categories (e.g., "financial"), timestamp | Compliance monitoring |
| **Login Events** | User ID, success/failure, IP address, hour of day, day of week | Security analysis |

### ❌ We NEVER Log:

| Category | Examples | Why Not |
|----------|----------|---------|
| **Passwords** | `passwordHash`, plaintext passwords | Security risk |
| **API Keys** | `apiKey`, `authKeyEncrypted`, `secretKey` | Credential exposure |
| **PII** | Email addresses, first/last names, SSN, phone numbers | Privacy violation |
| **Actual Financial Values** | `$50,000`, `12500.00`, monthly rates | Confidential business data |
| **Credentials** | `authValueEncrypted`, access tokens, refresh tokens | Security risk |

---

## Data Retention

| Data Type | Retention Period | Purge Method |
|-----------|------------------|--------------|
| **Permission Changes** | 2 years | Automated monthly job |
| **Sync Logs** | 90 days | Automated weekly job |
| **Activity Logs** | 1 year | Automated monthly job |
| **Bulk Operations** | 2 years (compliance) | Manual review before deletion |
| **Financial Access** | 7 years (regulatory) | Archived after 2 years |

---

## Privacy Safeguards

### 1. PII Sanitization

**Implementation:** `DataCollectionService.sanitizeState()`

Before logging any state (before/after), we automatically remove:

- `password`, `passwordHash`, `email`, `phone`
- `apiKey`, `credentials`, `authKeyEncrypted`, `authValueEncrypted`
- `firstName`, `lastName`, `fullName`, `address`, `ssn`

**Example:**

```typescript
// Input
const beforeState = {
  perm_Read: true,
  email: 'john.doe@example.com',
  monthlyRate: 5000
};

// Output (sanitized)
const sanitized = {
  perm_Read: true,
  hasMonthlyRate: true
  // email REMOVED
  // monthlyRate REMOVED (replaced with presence flag)
};
```

### 2. Financial Data Masking

We log **presence of financial data**, NOT actual values:

```typescript
// ❌ NEVER logged
{ monthlyRate: 5000, purchasePrice: 125000 }

// ✅ LOGGED instead
{ hasMonthlyRate: true, hasPurchasePrice: true }
```

### 3. User ID Anonymization

We log **user IDs** (UUIDs), not usernames or emails:

```typescript
// ❌ NEVER logged
{ username: 'john.doe', email: 'john.doe@example.com' }

// ✅ LOGGED instead
{ userId: '550e8400-e29b-41d4-a716-446655440000' }
```

### 4. External ID Tracking

For PEMS integration, we track **external IDs** for data lineage:

```typescript
// Logged for data lineage
{
  entityType: 'User',
  entityId: 'local-uuid',
  externalId: 'PEMS-PM001',  // PEMS user code
  externalSystem: 'PEMS'
}
```

This enables:
- Tracing data origin (which PEMS entity synced this?)
- Conflict resolution (detect duplicate syncs)
- Cross-system correlation (link local users to PEMS users)

---

## Performance Guarantees

All AI data hooks are **non-blocking** and add **< 10ms overhead** per operation:

| Operation | Target Latency | Enforcement Method |
|-----------|----------------|-------------------|
| Permission Change | < 10ms | Fire-and-forget async logging |
| External Sync | < 10ms | Fire-and-forget async logging |
| User Activity | < 5ms | Fire-and-forget async logging |
| Bulk Operation | < 10ms | Fire-and-forget async logging |
| Financial Access | < 10ms | Fire-and-forget async logging |

**Monitoring:** If any operation exceeds 10ms, a warning is logged:

```typescript
logger.warn('Permission change logging exceeded 10ms', { duration: 12, action: 'grant' });
```

---

## AI Training Data Queries

### Aggregated Statistics Only

When AI models query historical data, they receive **aggregated statistics**, NOT raw logs:

```typescript
// ✅ AI receives this
{
  totalEvents: 1250,
  actionDistribution: { 'permission:grant': 450, 'permission:revoke': 120, ... },
  hourlyDistribution: { 9: 200, 10: 180, 14: 300, ... },
  userActivitySummary: {
    'user-uuid-1': { actions: 50, lastSeen: '2025-11-27T14:30:00Z' },
    'user-uuid-2': { actions: 32, lastSeen: '2025-11-27T13:15:00Z' }
  }
}

// ❌ AI NEVER receives raw logs with metadata
```

### Query Methods

| Method | Purpose | Privacy Protection |
|--------|---------|-------------------|
| `getAITrainingData()` | Aggregate stats for pattern analysis | Returns counts, NOT individual events |
| `getPermissionHistory()` | Historical permission decisions | User IDs only, no usernames |
| `getUserActivityBaseline()` | Typical behavior for anomaly detection | Aggregates by hour/day, no PII |

---

## Compliance

### GDPR Compliance

- **Right to Access:** Users can request their audit logs via API endpoint `/api/audit/logs?userId={uuid}`
- **Right to Deletion:** Audit logs are purged according to retention schedule
- **Data Minimization:** We collect only what's necessary for AI training and security
- **Consent:** Users are notified of AI data collection in Terms of Service

### SOX Compliance (Financial Data)

- **Audit Trail:** All financial data access is logged (frequency, not values)
- **Retention:** 7-year retention for financial access logs
- **Segregation of Duties:** Only users with `perm_ViewFinancials` can access financial data

### ISO 27001 Compliance

- **Logging:** All security-relevant events are logged (login, permission changes, bulk operations)
- **Monitoring:** Anomaly detection identifies unusual patterns
- **Incident Response:** Audit logs enable forensic analysis

---

## AI Use Case Prerequisites

Each AI use case requires specific data collection:

| Use Case | Required Data | Collection Method |
|----------|---------------|-------------------|
| **Permission Suggestions (UC #1)** | Historical permission grant/revoke decisions | `logPermissionChange()` |
| **Anomaly Detection (UC #2)** | Baseline user activity patterns | `logUserActivity()` |
| **Financial Monitoring (UC #8)** | Financial access frequency (NOT actual costs) | `logFinancialAccess()` |
| **Audit Search (UC #18)** | Semantic event metadata (who/what/when/why) | All log methods |
| **Role Drift Detection (UC #19)** | Permission overrides and role changes over time | `logPermissionChange()` |

---

## Verification & Testing

### Automated Tests

**Verification Script:** `backend/scripts/verify-ai-data-collection.ts`

Tests:
1. ✅ Permission changes logged with before/after states
2. ✅ External entity syncs tracked with data lineage
3. ✅ Bulk operations flagged for review (> 500 records)
4. ✅ Financial access logged WITHOUT actual values
5. ✅ PII is NEVER present in audit metadata
6. ✅ All operations complete in < 50ms (including DB write)

**Usage:**
```bash
cd backend
npx tsx scripts/verify-ai-data-collection.ts
```

### Manual Verification

**Query Audit Logs for PII:**

```sql
-- Search for PII in audit metadata (should return 0 rows)
SELECT id, action, metadata
FROM audit_logs
WHERE
  LOWER(metadata::text) LIKE '%email%' OR
  LOWER(metadata::text) LIKE '%password%' OR
  LOWER(metadata::text) LIKE '%apikey%' OR
  LOWER(metadata::text) LIKE '%firstname%';
```

**Query Financial Values in Metadata:**

```sql
-- Search for actual cost values (should return 0 rows)
SELECT id, action, metadata
FROM audit_logs
WHERE metadata::text ~ '\$\d+|\d+\.\d{2}';
```

---

## Integration Points

### Controllers

| Controller | Integration Status | AI Hooks Used |
|------------|-------------------|---------------|
| `userOrgController.ts` | ✅ Integrated (line 271-291) | `logPermissionChange()` |
| `PemsSyncService.ts` | ✅ Integrated (line 628-643, 660-675) | `logExternalEntitySync()` |
| `PemsUserSyncService.ts` | ✅ Integrated (line 524-539) | `logExternalEntitySync()` |
| `orgController.ts` | ⚠️ Pending | `logPermissionChange()`, `logOrganizationSwitch()` |

### Middleware

- **Audit Context:** `injectAuditContext()` middleware captures IP, User-Agent, Session ID
- **Applied globally:** All API routes have audit context available via `req.auditContext`

---

## Future Enhancements

### Phase 7: AI Model Training

Once sufficient data is collected (6+ months), enable:

1. **Permission Suggestions:** Train ML model on historical permission decisions
2. **Anomaly Detection:** Establish baseline patterns and flag deviations
3. **Behavioral Quiet Mode:** Learn optimal notification timing per user
4. **Predictive Alerts:** Warn admins of potential security issues before they occur

### Privacy-Preserving Techniques

1. **Differential Privacy:** Add noise to aggregated statistics
2. **Federated Learning:** Train models without centralizing raw data
3. **Homomorphic Encryption:** Compute on encrypted audit logs

---

## Approval & Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Security Officer** | TBD | _________ | ______ |
| **Privacy Officer** | TBD | _________ | ______ |
| **Engineering Lead** | TBD | _________ | ______ |
| **Compliance Officer** | TBD | _________ | ______ |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-27 | AI Agent | Initial privacy policy for Phase 6, Task 6.5 |

---

## Contact

For questions about AI data collection, contact:

- **Security Team:** security@pfavanguard.com
- **Privacy Team:** privacy@pfavanguard.com
- **Engineering Team:** engineering@pfavanguard.com

---

**Document Classification:** Internal Use Only
**Review Schedule:** Quarterly
**Next Review:** 2026-02-27
