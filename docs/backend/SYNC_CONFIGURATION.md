# PEMS Sync Configuration Guide

**ADR-008: Bi-directional PEMS Synchronization**
**Last Updated:** 2025-11-28
**Status:** Phase 1 (Environment Setup)

---

## Overview

This document explains how to configure the PEMS write synchronization worker, which automatically pushes PFA record modifications from PostgreSQL to the PEMS API.

**Architecture**: Mirror + Delta Pattern
**Sync Direction**: PostgreSQL → PEMS (Write-back)
**Trigger**: Cron-based polling (default: every 60 seconds)
**Batching**: Up to 100 records per sync cycle
**Resilience**: 3 retry attempts with exponential backoff

---

## Environment Variables

### Core Sync Worker Configuration

```bash
# Enable/disable the write sync worker
ENABLE_WRITE_SYNC=true

# Cron schedule (standard cron format)
# Default: */1 * * * * = Every 1 minute
# Examples:
#   */5 * * * * = Every 5 minutes
#   0 */1 * * * = Every hour on the hour
#   0 9-17 * * 1-5 = Every hour 9am-5pm Mon-Fri
WRITE_SYNC_SCHEDULE="*/1 * * * *"

# Maximum records to process per sync cycle
WRITE_SYNC_BATCH_SIZE=100

# Retry configuration for failed writes
WRITE_SYNC_MAX_RETRIES=3
WRITE_SYNC_RETRY_DELAY=5000  # Initial delay in milliseconds (5s → 10s → 20s)
```

### PEMS API Rate Limiting

```bash
# Maximum API requests per second
# PEMS enforces 10 req/sec limit; exceeding triggers 429 errors
PEMS_API_RATE_LIMIT=10
```

### PEMS Write API Credentials

**Production Credentials** (stored encrypted in database):
- PEMS write credentials are stored in the `ApiServer` table
- Each organization can have separate PEMS API credentials
- Credentials are encrypted using AES-256-GCM before storage

**Development/Testing Credentials** (`.env` fallback):
```bash
PEMS_WRITE_ENDPOINT="https://us1.eam.hxgnsmartcloud.com:443/axis/restservices/update"
PEMS_WRITE_USERNAME="APIUSER"
PEMS_WRITE_PASSWORD="<use-encrypted-value>"
PEMS_WRITE_TENANT="BECHTEL_DEV"
```

**CRITICAL SECURITY**: Never commit plaintext API credentials to version control.

---

## Setting PEMS API Credentials

### Option 1: Database Configuration (Recommended)

Store credentials per organization in the `ApiServer` table:

```bash
# Use the Admin Dashboard UI:
1. Navigate to Admin → Integrations Hub → API Servers
2. Add/Edit PEMS API Server
3. Enter credentials (auto-encrypted before storage)
4. Test connection before saving
```

**Programmatic Setup**:
```typescript
import { encryptionService } from './utils/encryption';

const encryptedPassword = encryptionService.encrypt('BEOSugarland2025!');

await prisma.apiServer.create({
  data: {
    name: 'PEMS Production',
    baseUrl: 'https://pems.example.com/api',
    authType: 'BASIC',
    credentials: {
      username: 'APIUSER',
      password: encryptedPassword,
      tenant: 'BECHTEL_PROD'
    },
    organizationId: 'ORG_ID',
    isActive: true
  }
});
```

### Option 2: Environment Variables (Development Only)

For local testing, use `.env`:

```bash
# Generate encryption key (do this ONCE)
openssl rand -hex 32

# Set in .env
ENCRYPTION_KEY="<64-character-hex-string>"

# Encrypt credentials using Node.js script
npx tsx scripts/encrypt-credentials.ts --password "BEOSugarland2025!"
# Output: u8F3k...base64...encrypted...

# Add to .env
PEMS_WRITE_PASSWORD="u8F3k...encrypted..."
```

**Security Notes**:
- `.env` is git-ignored and never committed
- Production uses AWS Secrets Manager or Azure Key Vault (see `SECRETS_MANAGEMENT.md`)
- Rotate credentials every 90 days

---

## Adjusting Sync Schedule for Different Environments

### Development (Low Traffic)
```bash
# Every 5 minutes to reduce API load
WRITE_SYNC_SCHEDULE="*/5 * * * *"
WRITE_SYNC_BATCH_SIZE=50
```

### Staging (Moderate Traffic)
```bash
# Every 2 minutes for testing
WRITE_SYNC_SCHEDULE="*/2 * * * *"
WRITE_SYNC_BATCH_SIZE=100
```

### Production (High Traffic)
```bash
# Every 1 minute for near-real-time sync
WRITE_SYNC_SCHEDULE="*/1 * * * *"
WRITE_SYNC_BATCH_SIZE=100
PEMS_API_RATE_LIMIT=10  # Respect PEMS rate limits
```

### Business Hours Only
```bash
# Every 1 minute, Monday-Friday 8am-6pm
WRITE_SYNC_SCHEDULE="*/1 8-18 * * 1-5"
```

---

## Disabling Sync for Testing

### Disable Globally
```bash
ENABLE_WRITE_SYNC=false
```

### Disable Per-Organization
```sql
-- Temporarily disable sync for an organization
UPDATE "Organization"
SET "settings" = jsonb_set("settings", '{enablePemsWriteSync}', 'false')
WHERE "id" = 'ORG_ID';
```

### Disable Per-API Server
```sql
-- Temporarily disable an API server
UPDATE "ApiServer"
SET "isActive" = false
WHERE "id" = 'SERVER_ID';
```

---

## Monitoring Sync Worker

### Check Worker Status
```bash
# View worker logs
tail -f backend/logs/sync-worker.log

# Check last successful sync
psql -d pfa_vanguard -c "SELECT * FROM \"SyncJob\" ORDER BY \"startedAt\" DESC LIMIT 10;"
```

### Key Metrics to Monitor
- **Success Rate**: Percentage of records synced without errors
- **Retry Rate**: Percentage requiring retries (should be <5%)
- **Average Batch Size**: How many records per sync cycle
- **API Response Time**: PEMS API latency
- **Error Types**: 401 (auth), 429 (rate limit), 500 (server error)

### Health Checks
```bash
# Endpoint returns sync worker health
curl http://localhost:3001/api/health/sync-worker

# Response:
{
  "status": "healthy",
  "lastSync": "2025-11-28T10:30:00Z",
  "pendingRecords": 25,
  "failedRecords": 0,
  "nextScheduledRun": "2025-11-28T10:31:00Z"
}
```

---

## Troubleshooting

### Worker Not Running
```bash
# Check environment variable
echo $ENABLE_WRITE_SYNC  # Should be "true"

# Check cron jobs are enabled
echo $ENABLE_CRON_JOBS  # Should be "true"

# Restart backend server
npm run dev
```

### High Retry Rate (>10%)
```bash
# Check PEMS API connectivity
npx tsx scripts/test-pems-endpoint.ts

# Check rate limiting
# If seeing 429 errors, reduce batch size:
WRITE_SYNC_BATCH_SIZE=50
PEMS_API_RATE_LIMIT=5
```

### Credentials Invalid (401 Errors)
```bash
# Test credentials directly
npx tsx scripts/verify-pems-credentials.ts

# Rotate credentials in Admin Dashboard
# Then restart worker
```

### Records Stuck in "pending_sync" State
```bash
# Check error details
psql -d pfa_vanguard -c "
  SELECT id, \"syncState\", \"syncError\", \"syncRetryCount\"
  FROM \"PfaMirror\"
  WHERE \"syncState\" = 'sync_error'
  ORDER BY \"updatedAt\" DESC
  LIMIT 20;
"

# Manually reset stuck records (use with caution)
npx tsx scripts/reset-sync-state.ts --recordIds "ID1,ID2,ID3"
```

---

## Performance Tuning

### Optimize Batch Size
```bash
# Formula: batch_size = (rate_limit * sync_interval_seconds) / safety_margin
# Example: (10 req/sec * 60 sec) / 6 = 100 records

# Conservative (fewer API calls)
WRITE_SYNC_BATCH_SIZE=50

# Aggressive (maximize throughput)
WRITE_SYNC_BATCH_SIZE=150
```

### Optimize Retry Strategy
```bash
# Default: 5s → 10s → 20s (max 3 retries)
# Fast retry (for transient errors)
WRITE_SYNC_RETRY_DELAY=2000  # 2s → 4s → 8s

# Slow retry (for rate limiting)
WRITE_SYNC_RETRY_DELAY=10000  # 10s → 20s → 40s
```

---

## Security Checklist

- [ ] `ENCRYPTION_KEY` is 64 hex characters (32 bytes)
- [ ] PEMS credentials are encrypted before database storage
- [ ] `.env` file is git-ignored and never committed
- [ ] Production uses AWS Secrets Manager or Azure Key Vault
- [ ] API credentials are rotated every 90 days
- [ ] Sync worker runs with least-privilege service account
- [ ] API rate limits are enforced client-side
- [ ] Failed sync attempts are logged for audit

---

## Related Documentation

- **[SECRETS_MANAGEMENT.md](./SECRETS_MANAGEMENT.md)** - Production credential encryption
- **[API_REFERENCE.md](./API_REFERENCE.md)** - PEMS sync endpoints
- **[../adrs/ADR-008-bidirectional-pems-sync/](../adrs/ADR-008-bidirectional-pems-sync/)** - Architecture decision
- **[DATABASE_MONITORING.md](./DATABASE_MONITORING.md)** - Database performance

---

## Quick Reference

```bash
# Enable sync worker
ENABLE_WRITE_SYNC=true

# Sync every 1 minute
WRITE_SYNC_SCHEDULE="*/1 * * * *"

# Batch 100 records per cycle
WRITE_SYNC_BATCH_SIZE=100

# Retry failed writes 3 times
WRITE_SYNC_MAX_RETRIES=3

# Respect PEMS rate limit (10 req/sec)
PEMS_API_RATE_LIMIT=10
```

**Test Configuration**:
```bash
npx tsx scripts/test-sync-worker-config.ts
```

---

**Version:** 1.0
**ADR:** ADR-008 Phase 1, Task 1.2
**Next:** Implement sync worker service (Task 1.3)
