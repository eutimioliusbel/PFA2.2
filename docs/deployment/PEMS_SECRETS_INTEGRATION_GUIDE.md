# PEMS API Client - AWS Secrets Manager Integration Guide

**P0-2 Implementation**: How to update PEMS API clients to use SecretsService

---

## Quick Start

### Step 1: Import SecretsService

```typescript
import { secretsService } from '../services/secrets/SecretsService';
```

### Step 2: Replace Hardcoded Credentials

**Before (INSECURE)**:
```typescript
const pemsApiUrl = process.env.PEMS_API_URL;
const pemsApiKey = process.env.PEMS_API_KEY;

const response = await axios.put(
  `${pemsApiUrl}/pfa/${pfaId}`,
  payload,
  {
    headers: {
      'Authorization': `Bearer ${pemsApiKey}`,
    },
  }
);
```

**After (SECURE)**:
```typescript
const credentials = await secretsService.getPemsCredentials(organizationId);

const response = await axios.put(
  `${credentials.apiUrl}/pfa/${pfaId}`,
  payload,
  {
    headers: {
      'Authorization': `Bearer ${credentials.apiKey}`,
    },
  }
);
```

---

## Files to Update

### 1. PEMS Sync Service

**File**: `backend/src/services/pems/PemsSyncService.ts`

**Update**: `syncFromPems()` method

```typescript
async syncFromPems(organizationId: string, syncMode: 'full' | 'incremental') {
  // Get credentials from AWS Secrets Manager
  const credentials = await secretsService.getPemsCredentials(organizationId);

  // Use credentials in API calls
  const response = await axios.get(
    `${credentials.apiUrl}/pfa`,
    {
      headers: {
        'Authorization': `Bearer ${credentials.apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  // ... rest of sync logic
}
```

### 2. PEMS Write API Client

**File**: `backend/src/services/pems/PemsWriteApiClient.ts`

**Update**: All API methods

```typescript
class PemsWriteApiClient {
  async updatePfa(pfaId: string, changes: any, organizationId: string) {
    // Get credentials from AWS Secrets Manager
    const credentials = await secretsService.getPemsCredentials(organizationId);

    const response = await axios.put(
      `${credentials.apiUrl}/pfa/${pfaId}`,
      changes,
      {
        headers: {
          'Authorization': `Bearer ${credentials.apiKey}`,
        },
      }
    );

    return response.data;
  }

  async testConnection(organizationId: string) {
    const credentials = await secretsService.getPemsCredentials(organizationId);

    const response = await axios.get(
      `${credentials.apiUrl}/health`,
      {
        headers: {
          'Authorization': `Bearer ${credentials.apiKey}`,
        },
      }
    );

    return response.status === 200;
  }
}
```

### 3. API Config Controller

**File**: `backend/src/controllers/apiConfigController.ts`

**Update**: Test endpoint method

```typescript
async testApiConnection(req: AuthRequest, res: Response) {
  const { organizationId } = req.body;

  try {
    // Get credentials from AWS Secrets Manager
    const credentials = await secretsService.getPemsCredentials(organizationId);

    // Test connection
    const response = await axios.get(
      `${credentials.apiUrl}/health`,
      {
        headers: {
          'Authorization': `Bearer ${credentials.apiKey}`,
        },
        timeout: 5000,
      }
    );

    res.json({
      success: true,
      message: 'Connection successful',
      apiUrl: credentials.apiUrl, // Safe to return URL
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Connection failed',
      message: error.message,
    });
  }
}
```

---

## AWS Secrets Setup

### Create Secrets for Each Organization

**Secret Naming Convention**: `pfa-vanguard/pems/{organizationId}`

**For RIO Organization**:
```bash
aws secretsmanager create-secret \
  --name pfa-vanguard/pems/org-rio \
  --description "PEMS API credentials for RIO organization" \
  --secret-string '{
    "apiUrl": "https://pems-rio.example.com/api",
    "apiKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "username": "pfa_vanguard",
    "password": "optional-password"
  }'
```

**For PORTARTHUR Organization**:
```bash
aws secretsmanager create-secret \
  --name pfa-vanguard/pems/org-portarthur \
  --description "PEMS API credentials for Port Arthur organization" \
  --secret-string '{
    "apiUrl": "https://pems-portarthur.example.com/api",
    "apiKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "username": "pfa_vanguard",
    "password": "optional-password"
  }'
```

### Rotate Secrets (After Initial Setup)

```bash
# Update secret value (doesn't change secret name)
aws secretsmanager put-secret-value \
  --secret-id pfa-vanguard/pems/org-rio \
  --secret-string '{
    "apiUrl": "https://pems-rio.example.com/api",
    "apiKey": "NEW_API_KEY_HERE",
    "username": "pfa_vanguard",
    "password": "optional-password"
  }'

# Invalidate cache to force reload
# (SecretsService will reload on next access)
```

---

## IAM Permissions

### Required IAM Policy

**Attach to EC2 instance role / ECS task role**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowGetPemsSecrets",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:123456789012:secret:pfa-vanguard/pems/*"
    }
  ]
}
```

**Replace**:
- `us-east-1` with your region
- `123456789012` with your AWS account ID

---

## Error Handling

### Handle Missing Secrets

```typescript
try {
  const credentials = await secretsService.getPemsCredentials(organizationId);
  // ... use credentials
} catch (error) {
  if (error.message.includes('Secret not found')) {
    logger.error('PEMS credentials not configured', { organizationId });
    return res.status(500).json({
      success: false,
      error: 'CREDENTIALS_NOT_CONFIGURED',
      message: 'PEMS API credentials not configured for this organization',
    });
  }

  if (error.message.includes('Access denied')) {
    logger.error('AWS IAM permissions insufficient', { organizationId });
    return res.status(500).json({
      success: false,
      error: 'CREDENTIALS_ACCESS_DENIED',
      message: 'Unable to retrieve PEMS credentials (IAM permissions)',
    });
  }

  throw error; // Re-throw unexpected errors
}
```

### Cache Invalidation

```typescript
// Force refresh of credentials (e.g., after rotation)
secretsService.invalidateCache(`pfa-vanguard/pems/${organizationId}`);

// Next call will fetch fresh credentials from AWS
const credentials = await secretsService.getPemsCredentials(organizationId);
```

---

## Testing

### Unit Tests

```typescript
import { secretsService } from '../services/secrets/SecretsService';

describe('PEMS API with SecretsService', () => {
  it('should retrieve credentials from AWS Secrets Manager', async () => {
    const credentials = await secretsService.getPemsCredentials('org-rio');

    expect(credentials).toHaveProperty('apiUrl');
    expect(credentials).toHaveProperty('apiKey');
    expect(credentials.apiUrl).toContain('https://');
  });

  it('should cache credentials for 5 minutes', async () => {
    const start = Date.now();

    // First call - fetches from AWS
    await secretsService.getPemsCredentials('org-rio');
    const firstCallTime = Date.now() - start;

    // Second call - should be from cache (much faster)
    const cacheStart = Date.now();
    await secretsService.getPemsCredentials('org-rio');
    const cachedCallTime = Date.now() - cacheStart;

    expect(cachedCallTime).toBeLessThan(firstCallTime / 10);
  });
});
```

### Integration Tests

```typescript
import request from 'supertest';
import { app } from '../server';

describe('PEMS Sync with SecretsService', () => {
  it('should sync data using AWS Secrets Manager credentials', async () => {
    const response = await request(app)
      .post('/api/pems/sync')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        organizationId: 'org-rio',
        syncMode: 'incremental',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

---

## Migration Checklist

- [ ] Create secrets in AWS Secrets Manager for each organization
- [ ] Verify IAM permissions for EC2/ECS role
- [ ] Update `PemsSyncService.ts` to use `secretsService.getPemsCredentials()`
- [ ] Update `PemsWriteApiClient.ts` to use `secretsService.getPemsCredentials()`
- [ ] Update `apiConfigController.ts` test endpoint
- [ ] Remove `PEMS_API_URL` and `PEMS_API_KEY` from `.env` file
- [ ] Test sync functionality in staging environment
- [ ] Monitor logs for credential retrieval errors
- [ ] Deploy to production

---

## Rollback Plan

**If Issues Occur in Production**:

1. **Revert to .env credentials** (temporary):
   ```typescript
   // Fallback to env vars if SecretsService fails
   try {
     const credentials = await secretsService.getPemsCredentials(organizationId);
   } catch (error) {
     logger.warn('Falling back to .env credentials', { error });
     const credentials = {
       apiUrl: process.env.PEMS_API_URL,
       apiKey: process.env.PEMS_API_KEY,
     };
   }
   ```

2. **Check AWS Secrets Manager**:
   - Verify secrets exist
   - Verify secret values are valid JSON
   - Verify IAM permissions

3. **Check Logs**:
   ```bash
   # CloudWatch Logs
   aws logs tail /aws/ec2/pfa-vanguard --follow --filter "SecretsService"
   ```

---

**Document Version**: 1.0
**Last Updated**: 2025-11-28
**Status**: Implementation Guide
