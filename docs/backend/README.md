# Backend Documentation

**PFA Vanguard Backend API and Database Documentation**

Last Updated: 2025-11-28

---

## API Documentation

### API Reference
- **[API_REFERENCE.md](API_REFERENCE.md)** - Complete API endpoint reference
  - Authentication endpoints
  - PEMS sync endpoints
  - PFA data endpoints
  - User/Organization management
  - AI assistant endpoints
  - Audit log endpoints

---

## Database Documentation

### Schema & Architecture
- **[DATABASE_SCHEMA_V2.md](DATABASE_SCHEMA_V2.md)** - PostgreSQL schema and Prisma models
  - Core tables (User, Organization, PfaMirror, PfaModification)
  - Permission system (UserOrganization, 14 permission flags)
  - API configuration (ApiServer, ApiEndpoint)
  - Audit system (AuditLog, UserSession)
  - Bronze-Silver-Gold medallion architecture

- **[DATABASE_SECURITY.md](DATABASE_SECURITY.md)** - Database security patterns
  - Row-level security (RLS)
  - Encryption at rest
  - Connection pooling
  - SQL injection prevention
  - Audit trail requirements

---

## Data Quality & Validation

### Schema Validation
- **[SCHEMA_DRIFT_API_IMPLEMENTATION_SUMMARY.md](SCHEMA_DRIFT_API_IMPLEMENTATION_SUMMARY.md)** - Schema drift detection
  - Bronze layer schema capture
  - Silver layer transformation validation
  - Gold layer quality metrics
  - Drift detection algorithms
  - Automated alerts

- **[VALIDATION_CHECKLIST_SCHEMA_DRIFT_API.md](VALIDATION_CHECKLIST_SCHEMA_DRIFT_API.md)** - Schema validation checklist
  - Pre-deployment validation
  - Post-deployment verification
  - Regression testing
  - Performance benchmarks

- **[VALIDATION_STRATEGY.md](VALIDATION_STRATEGY.md)** - Data validation approach
  - Input validation (Zod schemas)
  - Business rule validation
  - Cross-field validation
  - External API validation

---

## API Features & Standards

### Endpoint Features
- **[ENDPOINT_FEATURES_SUMMARY.md](ENDPOINT_FEATURES_SUMMARY.md)** - API endpoint feature matrix
  - Authentication & authorization
  - Rate limiting
  - Caching strategies
  - Error handling patterns
  - Response formats

### Quality Standards
- **[QUALITY_STANDARDS_COMPLIANCE.md](QUALITY_STANDARDS_COMPLIANCE.md)** - Backend quality standards
  - TypeScript strict mode enforcement
  - 20-line function limit
  - Zero `any` types
  - 100% input validation
  - Comprehensive error handling
  - Audit logging requirements

---

## Architecture Patterns

### Medallion Architecture (Bronze-Silver-Gold)

**Bronze Layer** (Raw ingestion)
- Immutable source data capture
- Schema versioning
- Timestamp tracking
- No transformations

**Silver Layer** (Cleansed/enriched)
- Business rule application
- Data enrichment
- Deduplication
- Quality scoring

**Gold Layer** (Business-ready)
- Aggregations
- Derived metrics
- Presentation layer
- Performance optimization

### Permission System

**14 Permission Flags:**
- Data Scope: `perm_Read`, `perm_EditForecast`, `perm_EditActuals`, `perm_Delete`
- Data Operations: `perm_Import`, `perm_RefreshData`, `perm_Export`
- Financials: `perm_ViewFinancials`
- Process: `perm_SaveDraft`, `perm_Sync`
- Admin: `perm_ManageUsers`, `perm_ManageSettings`, `perm_ConfigureAlerts`, `perm_Impersonate`

**Enforcement:**
- Middleware: `requirePermission('Read')`
- API Server: `requireApiServerPermission(serverId, action)`
- Audit: All checks logged to `AuditLog`

---

## Quick Reference

### Common API Patterns

**Authentication:**
```typescript
POST /api/auth/login
POST /api/auth/register
POST /api/auth/verify
```

**PEMS Sync:**
```typescript
GET  /api/pems/configs
POST /api/pems/test
POST /api/pems/sync
```

**PFA Data:**
```typescript
GET    /api/pfa/records
POST   /api/pfa/records
PUT    /api/pfa/records/:id
DELETE /api/pfa/records/:id
```

**Organization Management:**
```typescript
GET  /api/organizations
POST /api/organizations
GET  /api/organizations/:id/users
POST /api/user-org-permissions
```

### Database Migrations

**Create Migration:**
```bash
cd backend
npx prisma migrate dev --name description
```

**Apply Migration:**
```bash
npx prisma migrate deploy
```

**Reset Database (DEV ONLY):**
```bash
npx prisma migrate reset
```

---

## Testing

### Integration Tests
Location: `backend/tests/integration/`

Key test suites:
- `multiTenantIsolation.test.ts` - Organization isolation
- `permissions.test.ts` - Permission enforcement
- `dataIntegrity.test.ts` - Data consistency
- `pemsSyncFiltering.test.ts` - PEMS sync filtering

### Security Tests
Location: `backend/tests/security/`

Red team tests:
- SQL injection prevention
- XSS protection
- CSRF protection
- Permission bypass attempts
- Token manipulation

---

## Related Documentation

- **[Architecture Overview](../ARCHITECTURE.md)** - Complete system architecture
- **[Deployment Guide](../deployment/DEPLOYMENT_RUNBOOK.md)** - Deployment procedures
- **[Development Log](../DEVELOPMENT_LOG.md)** - Implementation history
- **[ADR Index](../adrs/README.md)** - Architectural decisions

---

**Total Files:** 13 backend documentation files

**Last Updated:** 2025-11-28 (Documentation reorganization)
