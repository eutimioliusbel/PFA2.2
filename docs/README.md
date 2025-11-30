# PFA Vanguard Documentation

**Master Documentation Index**

Last Updated: 2025-11-28

---

## Core Documentation (Read First)

### Architecture & Standards
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Complete system architecture and design patterns
- **[CODING_STANDARDS.md](CODING_STANDARDS.md)** - TypeScript strict mode, 20-line limit, security standards
- **[DOCUMENTATION_STANDARDS.md](DOCUMENTATION_STANDARDS.md)** - Documentation structure and git workflow

### Development Logs
- **[DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md)** - Track all implementation work (REQUIRED for all features)
- **[TESTING_LOG.md](TESTING_LOG.md)** - Test execution history and results

### Planning & Roadmap
- **[FUTURE_ENHANCEMENTS.md](FUTURE_ENHANCEMENTS.md)** - Feature roadmap and enhancement backlog
- **[WHATS_NEXT.md](WHATS_NEXT.md)** - Immediate next steps and priorities
- **[AI_DATA_HOOKS.md](AI_DATA_HOOKS.md)** - AI integration patterns and data collection

---

## Backend Documentation

Location: `backend/`

- **[API_REFERENCE.md](backend/API_REFERENCE.md)** - Complete API endpoint reference
- **[DATABASE_SCHEMA_V2.md](backend/DATABASE_SCHEMA_V2.md)** - PostgreSQL schema and Prisma models
- **[DATABASE_SECURITY.md](backend/DATABASE_SECURITY.md)** - Database security patterns
- **[ENDPOINT_FEATURES_SUMMARY.md](backend/ENDPOINT_FEATURES_SUMMARY.md)** - API endpoint feature matrix
- **[SCHEMA_DRIFT_API_IMPLEMENTATION_SUMMARY.md](backend/SCHEMA_DRIFT_API_IMPLEMENTATION_SUMMARY.md)** - Schema drift detection
- **[QUALITY_STANDARDS_COMPLIANCE.md](backend/QUALITY_STANDARDS_COMPLIANCE.md)** - Backend quality standards
- **[VALIDATION_CHECKLIST_SCHEMA_DRIFT_API.md](backend/VALIDATION_CHECKLIST_SCHEMA_DRIFT_API.md)** - Schema validation
- **[VALIDATION_STRATEGY.md](backend/VALIDATION_STRATEGY.md)** - Data validation approach

**Files:** 13 markdown files

---

## Deployment Documentation

Location: `deployment/`

### Deployment Guides
- **[DEPLOYMENT_RUNBOOK.md](deployment/DEPLOYMENT_RUNBOOK.md)** - Step-by-step deployment procedures
- **[PRODUCTION_DEPLOYMENT_CHECKLIST.md](deployment/PRODUCTION_DEPLOYMENT_CHECKLIST.md)** - Pre-deployment checklist
- **[STAGING_MONITORING_CHECKLIST.md](deployment/STAGING_MONITORING_CHECKLIST.md)** - Staging environment monitoring
- **[DEPLOYMENT_SUMMARY.md](deployment/DEPLOYMENT_SUMMARY.md)** - Deployment architecture summary

### Infrastructure Setup
- **[DOCKER_SETUP.md](deployment/DOCKER_SETUP.md)** - Docker configuration (development)
- **[DOCKER_SETUP_WINDOWS.md](deployment/DOCKER_SETUP_WINDOWS.md)** - Windows-specific Docker setup
- **[POSTGRESQL_DEPLOYMENT_QUICKSTART.md](deployment/POSTGRESQL_DEPLOYMENT_QUICKSTART.md)** - PostgreSQL quickstart
- **[POSTGRESQL_INSTALLATION_OPTIONS.md](deployment/POSTGRESQL_INSTALLATION_OPTIONS.md)** - PostgreSQL installation methods

### Operations
- **[ROLLBACK_PLAN.md](deployment/ROLLBACK_PLAN.md)** - Rollback procedures and disaster recovery
- **[MONITORING_PLAYBOOK.md](deployment/MONITORING_PLAYBOOK.md)** - Monitoring and alerting setup
- **[PEMS_SECRETS_INTEGRATION_GUIDE.md](deployment/PEMS_SECRETS_INTEGRATION_GUIDE.md)** - PEMS secrets management

**Files:** 11 markdown files

---

## Architectural Decision Records (ADRs)

Location: `adrs/`

**Index:** [adrs/README.md](adrs/README.md)

### Active ADRs

#### ADR-004: Database Architecture (Hybrid)
**Status:** Implemented | **Location:** `adrs/ADR-004-database-architecture-hybrid/`

#### ADR-005: Multi-Tenant Access Control
**Status:** Implemented | **Location:** `adrs/ADR-005-multi-tenant-access-control/`
**Features:** 14 permissions, audit ledger, PATs, impersonation

#### ADR-006: API Server & Endpoint Architecture
**Status:** In Design | **Location:** `adrs/ADR-006-api-server-and-endpoint-architecture/`

#### ADR-007: API Connectivity & Intelligence Layer
**Status:** In Design | **Location:** `adrs/ADR-007-api-connectivity-and-intelligence-layer/`
**Features:** Bronze-Silver-Gold medallion pipeline

#### ADR-008: Bidirectional PEMS Sync
**Status:** Implemented | **Location:** `adrs/ADR-008-bidirectional-pems-sync/`
**Features:** Mirror + Delta architecture, WebSocket real-time sync, security P0 fixes
**Files:** 29 markdown files

---

## Archive

Location: `archive/`

Historical documents organized by date:

- `2025-11-25-mirror-delta/` - Mirror + Delta architecture planning
- `2025-11-26-restart/` - Restart guides and recovery procedures
- `2025-11-27-endpoint-updates/` - Endpoint migration and grid layout updates
- `2025-11-27-sessions/` - Session summaries
- `2025-11-28-implementation-summaries/` - Task completion summaries
- `2025-11-28-refactoring/` - Refactoring plans and progress

---

## Quick Links

- **[../CLAUDE.md](../CLAUDE.md)** - AI context router and instruction manual
- **[../README.md](../README.md)** - Project overview and quickstart

---

**Total Documentation Files:** 259 markdown files

**Last Reorganization:** 2025-11-28 ([DOCUMENTATION_REORGANIZATION_MANIFEST.md](DOCUMENTATION_REORGANIZATION_MANIFEST.md))
