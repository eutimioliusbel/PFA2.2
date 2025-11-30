# ADR-005 Deployment Guide

**Document Type**: Deployment Guide
**Status**: Ready for Deployment
**Created**: 2025-11-28
**Target**: Production/Staging Environment

---

## Pre-Deployment Checklist

### 1. Database Preparation

**Verify Database Connection**:
```bash
cd backend
npx prisma db pull  # Verify connection to database
```

**Apply Schema Changes**:
```bash
npx prisma db push  # Apply schema changes (development)
# OR
npx prisma migrate deploy  # Apply migrations (production)
```

**Generate Prisma Client**:
```bash
npx prisma generate
```

### 2. Seed Initial Data

**Run Seed Script**:
```bash
npm run prisma:seed
```

**Expected Output**:
```
✅ Database seed completed successfully!

📋 Summary:
   Users:                    6 (admin + 5 users)
   Organizations:            2 (RIO, PORTARTHUR)
   Role Templates:           5 (Viewer, Editor, Portfolio Manager, BEO Analyst, Administrator)
   System Dictionary:        26 entries (6 categories)
```

**Verify Seed Data**:
```bash
npx tsx backend/scripts/check-role-templates.ts  # Verify role templates
```

### 3. Environment Variables

**Required Environment Variables** (add to `.env`):
```bash
# Existing variables (no changes needed)
DATABASE_URL="postgresql://..."
JWT_SECRET="..."
ENCRYPTION_KEY="..."

# No new environment variables required for ADR-005 components
```

### 4. Build and Test

**TypeScript Compilation**:
```bash
cd backend
npx tsc --noEmit  # Check for type errors
```

**Start Development Server**:
```bash
npm run dev
```

**Run Integration Tests**:
```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Run tests
npx tsx backend/scripts/test-adr-005-endpoints.ts
```

**Expected Test Output**:
```
🧪 Testing ADR-005 Endpoints
═══════════════════════════════════════════════════════════

Step 1: Authentication
───────────────────────────────────────────────────────────
✓ Login successful

Step 2: Role Templates
───────────────────────────────────────────────────────────
✓ GET /api/role-templates - 200 (45ms)

Step 3: Personal Access Tokens
───────────────────────────────────────────────────────────
✓ GET /api/tokens - 200 (12ms)
✓ GET /api/tokens/stats - 200 (8ms)

...

✅ All tests passed!
```

---

## Deployment Steps

### Step 1: Database Migration (Production)

**Option A: Using Prisma Migrate** (Recommended for Production)
```bash
# Create migration from schema changes
npx prisma migrate dev --name add_adr_005_components

# Deploy to production
npx prisma migrate deploy
```

**Option B: Using DB Push** (Development Only)
```bash
npx prisma db push
```

### Step 2: Seed Production Data

**Seed Script Options**:

1. **Full Seed** (includes test users):
```bash
npm run prisma:seed
```

2. **Role Templates Only**:
```bash
npx tsx backend/prisma/seeds/seedRoleTemplates.ts
```

3. **System Dictionary Only**:
```bash
npx tsx backend/prisma/seeds/seedSystemDictionary.ts
```

**Production Recommendation**: Run full seed in staging, then manually create production users.

### Step 3: Deploy Application

**Backend Deployment**:
```bash
cd backend
npm run build  # If using build process
npm run start  # Or use pm2, docker, etc.
```

**Frontend Deployment**:
```bash
cd ..
npm run build
# Deploy dist/ to hosting provider
```

### Step 4: Post-Deployment Verification

**Health Check**:
```bash
curl http://your-domain.com/health
```

**Test Authentication**:
```bash
curl -X POST http://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

**Test Role Templates Endpoint**:
```bash
curl http://your-domain.com/api/role-templates \
  -H "Authorization: Bearer {token}"
```

---

## Configuration Guide

### 1. Role Templates

**System Roles** (Created by Seed):
- **Viewer**: Read-only access, can export
- **Editor**: Edit forecasts, import data
- **Portfolio Manager**: Full data access including financials
- **BEO Analyst**: Financial access, alert configuration
- **Administrator**: Full system access

**Creating Custom Roles**:
```bash
POST /api/role-templates
{
  "name": "Project Coordinator",
  "description": "Can edit forecasts but not view financials",
  "perm_Read": true,
  "perm_EditForecast": true,
  "perm_Export": true,
  "perm_ViewFinancials": false
}
```

### 2. System Dictionary

**Default Categories** (Created by Seed):
- `equipment_class`: VEHICLE, HEAVY_MACHINERY, TOOLS, ELECTRONICS, SAFETY
- `status_type`: ACTIVE, INACTIVE, PENDING, DISCONTINUED
- `cost_center`: PROJECT, BEO, MAINTENANCE, CAPITAL
- `source_type`: RENTAL, PURCHASE, LEASE, OWNED
- `notification_type`: SYNC_SUCCESS, SYNC_FAILED, USER_ADDED, PERMISSION_CHANGED, SESSION_REVOKED
- `unit`: METER, FEET, KILOGRAM, POUND

**Adding Custom Dictionary Entries**:
```bash
POST /api/dictionary
{
  "category": "priority_level",
  "value": "CRITICAL",
  "label": "Critical Priority",
  "sortOrder": 0,
  "metadata": {
    "color": "red",
    "escalation_hours": 4
  }
}
```

### 3. Personal Access Tokens (PATs)

**Security Configuration**:
- Tokens are hashed with bcrypt (SALT_ROUNDS = 10)
- Raw tokens shown only once at creation
- Expiry options: 30 days, 90 days, 1 year, never

**Creating a PAT for CI/CD**:
```bash
POST /api/tokens
{
  "name": "GitHub Actions",
  "scopes": ["Read", "Export"],
  "expiresInDays": 90
}

Response:
{
  "token": "a1b2c3d4..."  # ⚠️ Save immediately!
}
```

**Using a PAT**:
```bash
curl http://your-domain.com/api/role-templates \
  -H "Authorization: Bearer {pat_token}"
```

### 4. Webhooks

**Configuring Slack Webhook**:
```bash
POST /api/webhooks
{
  "type": "slack",
  "name": "Operations Channel",
  "webhookUrl": "https://hooks.slack.com/services/...",
  "channelName": "#operations",
  "eventTriggers": ["sync_failed", "permission_changed"]
}
```

**Testing Webhook**:
```bash
POST /api/webhooks/{id}/test
```

### 5. Session Management

**Session Configuration**:
- Default expiry: 7 days
- Activity tracking: Updated on each request
- Kill-switch: Immediate invalidation

**Revoking User Sessions** (Admin):
```bash
POST /api/sessions/user/{userId}/revoke-all
{
  "includeCurrentSession": false
}
```

### 6. Trash Can

**Soft Delete Configuration**:
- Entities: User, Organization, PfaRecord
- Dependency tracking enabled
- Restore requires dependency resolution

**Restoring Deleted Item**:
```bash
POST /api/trash/{id}/restore
```

---

## Monitoring & Alerts

### Database Metrics

**Monitor These Queries**:
```sql
-- Role template usage
SELECT name, "usageCount" FROM role_templates ORDER BY "usageCount" DESC;

-- Active PATs
SELECT COUNT(*) FROM personal_access_tokens WHERE "isActive" = true;

-- Active sessions
SELECT COUNT(*) FROM user_sessions WHERE "isActive" = true AND "expiresAt" > NOW();

-- Webhook health
SELECT type, COUNT(*) as total,
       SUM(CASE WHEN "lastTestSuccess" = true THEN 1 ELSE 0 END) as healthy
FROM webhook_configs
WHERE "isActive" = true
GROUP BY type;

-- Trash can stats
SELECT "entityType", COUNT(*) as count
FROM soft_deleted_items
WHERE "permanentlyDeletedAt" IS NULL
GROUP BY "entityType";
```

### Application Metrics

**Key Metrics to Track**:
1. **PAT Creation Rate**: High rate may indicate security issue
2. **Session Revocations**: Spike indicates possible security incident
3. **Webhook Failures**: Monitor `lastTestSuccess` field
4. **Trash Can Size**: Monitor soft-deleted item count
5. **Dictionary Growth**: Track entry creation trends

**Alerts to Configure**:
```javascript
// Alert if PAT failure rate > 5% in 5 minutes
if (patFailureRate > 0.05) {
  sendAlert('High PAT failure rate detected');
}

// Alert if session revocations spike
if (sessionRevocationsPerMinute > 10) {
  sendAlert('Unusual session revocation activity');
}

// Alert if webhook failures exceed 10%
if (webhookFailureRate > 0.10) {
  sendAlert('Webhook integration issues detected');
}
```

---

## Rollback Procedure

### If Issues Are Detected

**Step 1: Disable New Routes** (Quick Fix)
```typescript
// In backend/src/server.ts, comment out:
// app.use('/api/role-templates', roleTemplateRoutes);
// app.use('/api/tokens', personalAccessTokenRoutes);
// app.use('/api/sessions', sessionRoutes);
// app.use('/api/webhooks', webhookRoutes);
// app.use('/api/dictionary', systemDictionaryRoutes);
// app.use('/api/trash', trashCanRoutes);
```

**Step 2: Revert Database Migration**
```bash
# If using Prisma Migrate
npx prisma migrate reset  # ⚠️ WARNING: Deletes all data

# Safer approach: Drop tables manually
psql -d your_database -c "DROP TABLE IF EXISTS role_templates CASCADE;"
psql -d your_database -c "DROP TABLE IF EXISTS personal_access_tokens CASCADE;"
psql -d your_database -c "DROP TABLE IF EXISTS user_sessions CASCADE;"
psql -d your_database -c "DROP TABLE IF EXISTS webhook_configs CASCADE;"
psql -d your_database -c "DROP TABLE IF EXISTS system_dictionary_entries CASCADE;"
psql -d your_database -c "DROP TABLE IF EXISTS soft_deleted_items CASCADE;"
```

**Step 3: Redeploy Previous Version**
```bash
git checkout {previous_commit}
npm run build
npm run start
```

---

## Troubleshooting

### Common Issues

**Issue 1: "Authentication failed" when testing endpoints**
```bash
# Solution: Verify JWT_SECRET matches in .env
grep JWT_SECRET backend/.env
```

**Issue 2: "Permission denied" errors**
```bash
# Solution: Verify admin user has all 14 permissions
npx tsx backend/scripts/check-admin-permissions.ts
```

**Issue 3: "Prisma Client not generated"**
```bash
# Solution: Regenerate Prisma Client
cd backend
npx prisma generate
```

**Issue 4: "Table does not exist" errors**
```bash
# Solution: Apply schema changes
npx prisma db push
```

**Issue 5: "No role templates found"**
```bash
# Solution: Run seed script
npm run prisma:seed
```

---

## Performance Tuning

### Database Optimization

**Index Verification**:
```sql
-- Verify indexes exist
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('role_templates', 'personal_access_tokens', 'user_sessions',
                  'webhook_configs', 'system_dictionary_entries', 'soft_deleted_items');
```

**Query Performance**:
```sql
-- Analyze slow queries
EXPLAIN ANALYZE
SELECT * FROM personal_access_tokens
WHERE "userId" = '...' AND "isActive" = true;
```

### Application Optimization

**Connection Pooling**:
```typescript
// Adjust Prisma connection pool
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")

  // Add connection pool settings
  relationMode = "prisma"
  poolSize = 20
  connectionTimeoutMillis = 5000
}
```

**Caching Strategy**:
- Cache role templates (rarely change)
- Cache system dictionary (static data)
- Do NOT cache PATs or sessions (security risk)

---

## Security Hardening

### Production Security Checklist

- [ ] Change default admin password
- [ ] Rotate JWT_SECRET
- [ ] Rotate ENCRYPTION_KEY
- [ ] Enable HTTPS for all endpoints
- [ ] Configure rate limiting for PAT endpoints
- [ ] Set up WAF rules for webhook URLs
- [ ] Enable audit logging for all permission changes
- [ ] Configure session timeout (7 days default)
- [ ] Set PAT expiry policy (90 days recommended)
- [ ] Review and remove unused role templates
- [ ] Purge trash can items older than 90 days

### Security Monitoring

**Daily Checks**:
- Review audit logs for permission changes
- Monitor PAT creation/revocation events
- Check for unusual session activity
- Verify webhook test results

**Weekly Checks**:
- Review trash can contents
- Audit active PATs (revoke unused)
- Check role template usage
- Update system dictionary as needed

---

## Support & Documentation

### Additional Resources

- [ADR-005 Implementation Plan](./adrs/ADR-005-multi-tenant-access-control/ADR-005-IMPLEMENTATION_PLAN.md)
- [ADR-005 Backend Summary](./ADR_005_BACKEND_IMPLEMENTATION_SUMMARY.md)
- [ADR-005 Frontend Summary](./ADR_005_UI_COMPONENTS_IMPLEMENTATION_SUMMARY.md)
- [API Reference](./backend/API_REFERENCE.md)
- [Development Log](./DEVELOPMENT_LOG.md)

### Contact

For deployment issues or questions:
- Create an issue in the repository
- Check `docs/ARCHITECTURE.md` for system overview
- Review `docs/DEVELOPMENT_LOG.md` for recent changes

---

**Deployment Status**: ✅ Ready for Production
**Last Updated**: 2025-11-28
**Maintainer**: PFA Vanguard Team
