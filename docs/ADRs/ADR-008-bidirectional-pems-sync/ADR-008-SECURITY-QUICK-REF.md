# ADR-008 Security Quick Reference
**For Developers Implementing Write-Back Sync**

---

## 🚨 STOP! Read This First

**ADR-008 implementation is BLOCKED until all P0 security issues are resolved.**

See: `docs/ADR-008-SECURITY-ASSESSMENT.md` for full details.

---

## Critical Security Checklist

### ✅ Before Writing ANY Code

- [ ] Read full security assessment (`ADR-008-SECURITY-ASSESSMENT.md`)
- [ ] All inputs validated with Zod schemas
- [ ] All database queries use parameterized inputs (Prisma)
- [ ] All outputs sanitized/escaped before rendering
- [ ] Authorization checks on EVERY endpoint
- [ ] Rate limiting configured for all sync routes
- [ ] Audit logging for all state changes
- [ ] CSRF tokens on state-changing operations
- [ ] Encryption keys NOT in .env file

---

## P0 Security Fixes Required

### 1. Input Validation (SQL Injection Prevention)

**WRONG:**
```typescript
// ❌ VULNERABLE
const { organizationId } = req.body;
const sync = await pemsSyncService.syncData(organizationId, ...);
```

**RIGHT:**
```typescript
// ✅ SECURE
import { z } from 'zod';

const SyncRequestSchema = z.object({
  organizationId: z.string().uuid(),
  apiConfigId: z.string().uuid(),
  syncType: z.enum(['full', 'incremental']).default('full')
});

const { organizationId, apiConfigId, syncType } = SyncRequestSchema.parse(req.body);
```

---

### 2. Authorization (IDOR Prevention)

**WRONG:**
```typescript
// ❌ VULNERABLE - No ownership check
export const getSyncStatus = async (req: Request, res: Response) => {
  const { syncId } = req.params;
  const sync = activeSyncs.get(syncId);
  res.json(sync);  // ❌ Leaks cross-org data
};
```

**RIGHT:**
```typescript
// ✅ SECURE
export const getSyncStatus = async (req: AuthRequest, res: Response) => {
  const { syncId } = req.params;
  const sync = activeSyncs.get(syncId);

  if (!sync) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }

  // ✅ Verify user has access to the organization
  const hasAccess = req.user?.organizations.some(
    org => org.organizationId === sync.organizationId
  );

  if (!hasAccess) {
    return res.status(404).json({ error: 'NOT_FOUND' });  // ✅ 404, not 403
  }

  // ✅ Check permission
  const orgPermissions = req.user?.organizations.find(
    org => org.organizationId === sync.organizationId
  )?.permissions;

  if (!orgPermissions?.perm_Read) {
    return res.status(403).json({ error: 'PERMISSION_DENIED' });
  }

  res.json(sync);
};
```

---

### 3. Output Sanitization (XSS Prevention)

**WRONG:**
```typescript
// ❌ VULNERABLE
function formatValue(value: unknown): string {
  return String(value);  // ❌ No HTML escaping
}

// Rendered in JSX
<div>{formatValue(conflict.localValue)}</div>  // ❌ XSS risk
```

**RIGHT:**
```typescript
// ✅ SECURE (Option 1: DOMPurify)
import DOMPurify from 'dompurify';

function formatValue(value: unknown): string {
  const stringValue = String(value);
  return DOMPurify.sanitize(stringValue, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
}

// ✅ SECURE (Option 2: React auto-escaping)
// React automatically escapes {} expressions
<div>{String(conflict.localValue)}</div>  // ✅ Auto-escaped

// ⚠️ NEVER use dangerouslySetInnerHTML without sanitization
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
```

---

### 4. Rate Limiting (DoS Prevention)

**WRONG:**
```typescript
// ❌ VULNERABLE - No rate limiting
router.post('/sync', requirePermission('perm_Sync'), startSync);
```

**RIGHT:**
```typescript
// ✅ SECURE
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis(env.REDIS_URL);

const syncRateLimiter = rateLimit({
  store: new RedisStore({ client: redis, prefix: 'rl:sync:' }),
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req: AuthRequest) => {
    return `${req.user?.userId}:${req.body.organizationId}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Sync rate limit exceeded. Try again in 1 minute.',
      retryAfter: 60
    });
  }
});

router.post('/sync',
  authenticateJWT,
  syncRateLimiter,  // ✅ Rate limit BEFORE permission check
  requirePermission('perm_Sync'),
  startSync
);
```

---

### 5. Credential Management (Encryption Key Security)

**WRONG:**
```typescript
// ❌ VULNERABLE - Key in .env file
// .env
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

// encryption.ts
const ENCRYPTION_KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex');
```

**RIGHT:**
```typescript
// ✅ SECURE - AWS Secrets Manager
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });

export const getEncryptionKey = async (): Promise<Buffer> => {
  const command = new GetSecretValueCommand({
    SecretId: 'pfa-vanguard/encryption-key'
  });

  const response = await client.send(command);
  return Buffer.from(response.SecretString!, 'hex');
};

// ✅ ALTERNATIVE - Docker Secrets
import fs from 'fs';

const keyPath = env.ENCRYPTION_KEY_FILE || '/run/secrets/encryption_key';
const ENCRYPTION_KEY = Buffer.from(fs.readFileSync(keyPath, 'utf8'), 'hex');
```

---

## Security Testing Commands

```bash
# Run all security tests
npm test tests/security/

# Run specific test suite
npm test -- sql-injection.test.ts
npm test -- idor-attack.test.ts
npm test -- rate-limit.test.ts
npm test -- xss-attack.test.tsx

# Run with coverage
npm test -- --coverage tests/security/

# Security audit dependencies
npm audit
npm audit fix

# Check for vulnerable packages
npx snyk test
```

---

## Security Headers Checklist

Add to `backend/src/server.ts`:

```typescript
import helmet from 'helmet';
import csrf from 'csurf';

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // Tailwind requires inline
      imgSrc: ["'self'", "data:", "https://api.dicebear.com"],
      connectSrc: ["'self'", "https://api.google.dev"],
      frameAncestors: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CSRF protection
const csrfProtection = csrf({ cookie: true });
app.use('/api', csrfProtection);

// Custom security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// HTTPS redirect (production only)
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https' && env.NODE_ENV === 'production') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});
```

---

## Audit Logging Template

```typescript
// Log all sync operations
await prisma.auditLog.create({
  data: {
    userId: req.user.userId,
    organizationId: req.organizationId,
    action: 'sync_started',
    resource: 'pems_sync',
    method: req.method,
    path: req.path,
    success: true,
    metadata: {
      syncId,
      syncType,
      apiConfigId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    }
  }
});

// Log conflicts
await prisma.auditLog.create({
  data: {
    userId: req.user.userId,
    organizationId: req.organizationId,
    action: 'conflict_resolved',
    resource: 'pems_conflict',
    method: 'POST',
    success: true,
    metadata: {
      conflictId,
      resolution: strategy,
      pfaId,
      fieldName: conflict.fieldName,
      chosenValue: resolution.chosenValue,
      timestamp: new Date().toISOString()
    }
  }
});
```

---

## Error Handling Best Practices

**WRONG:**
```typescript
// ❌ Information disclosure
catch (error) {
  res.status(500).json({
    error: error.message,  // ❌ Leaks internal structure
    stack: error.stack      // ❌ Leaks code paths
  });
}
```

**RIGHT:**
```typescript
// ✅ Secure error handling
import { logger } from '../utils/logger';

catch (error) {
  // Log detailed error server-side
  logger.error('Sync failed', {
    requestId: req.id,
    userId: req.user?.userId,
    error: error instanceof Error ? error.stack : String(error),
    query: { organizationId, apiConfigId }
  });

  // Return generic error to user
  res.status(500).json({
    error: 'SYNC_ERROR',
    message: 'Sync operation failed. Please contact support.',
    requestId: req.id  // ✅ For support correlation only
  });
}
```

---

## Security Review Checklist

Before submitting PR for ADR-008 implementation:

- [ ] All Zod schemas defined for request validation
- [ ] All endpoints have authorization checks
- [ ] All user inputs sanitized/escaped before rendering
- [ ] Rate limiting configured (10 req/min per user)
- [ ] CSRF protection enabled
- [ ] Audit logging for all mutations
- [ ] Error messages don't leak internal info
- [ ] No secrets in .env (use Secrets Manager)
- [ ] Security tests pass (100% coverage)
- [ ] Dependency audit clean (`npm audit`)
- [ ] Snyk scan clean (no high/critical vulns)
- [ ] Helmet security headers configured
- [ ] HTTPS enforced in production
- [ ] Transaction rollback on failures
- [ ] UUIDs used for IDs (not predictable timestamps)
- [ ] Service account for sync worker (not user credentials)

---

## Emergency Response

If a security vulnerability is discovered in production:

1. **Immediately disable the vulnerable endpoint:**
   ```typescript
   // In backend/src/routes/pemsSyncRoutes.ts
   router.post('/sync', (req, res) => {
     res.status(503).json({
       error: 'SERVICE_UNAVAILABLE',
       message: 'This endpoint is temporarily disabled for maintenance.'
     });
   });
   ```

2. **Review audit logs for exploitation:**
   ```sql
   SELECT * FROM audit_log
   WHERE action = 'sync_started'
   AND created_at > '2025-11-28'
   ORDER BY created_at DESC;
   ```

3. **Notify security team and stakeholders**

4. **Apply fix and re-test before re-enabling**

---

## Tools and Resources

**Security Scanners:**
- Garak: https://github.com/leondz/garak
- OWASP ZAP: https://www.zaproxy.org/
- Burp Suite: https://portswigger.net/burp
- Snyk: https://snyk.io/

**OWASP Resources:**
- LLM Top 10: https://owasp.org/www-project-top-10-for-large-language-model-applications/
- API Security Top 10: https://owasp.org/API-Security/
- Cheat Sheets: https://cheatsheetseries.owasp.org/

**Training:**
- OWASP Security Knowledge Framework: https://www.securityknowledgeframework.org/
- HackTheBox: https://www.hackthebox.com/

---

**Last Updated:** 2025-11-28
**Next Review:** After P0 fixes implemented
**Owner:** Security Team
