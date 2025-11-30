# PFA Vanguard

Construction equipment tracking system for Plan-Forecast-Actual lifecycle management.

[![Status](https://img.shields.io/badge/status-active_development-success.svg)]()
[![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)]()
[![ADR](https://img.shields.io/badge/ADR--005-implemented-green.svg)]()
[![Test Coverage](https://img.shields.io/badge/coverage-15%25-yellow.svg)]()
[![Permissions](https://img.shields.io/badge/permissions-14_granular-blue.svg)]()

---

## What is PFA Vanguard?

**PFA Vanguard** helps Project Managers track and optimize equipment costs across large industrial construction projects. Manages the complete **Plan → Forecast → Actuals** lifecycle for 10,000+ equipment requirements.

**Core Problem:** Prevent actual equipment costs from exceeding budgeted amounts by strategically adjusting forecasts.

**Key Features:**
- Real-time variance tracking (Plan vs. Forecast vs. Actual)
- Drag-and-drop timeline for 800+ simultaneous records
- Smart bulk operations with state-aware logic
- Multi-organization data isolation with 14 granular permissions
- PEMS integration for seamless external system sync
- Enterprise-grade audit ledger with time travel
- Financial data masking for compliance
- AI-powered permission hints and role suggestions
- Multi-channel notifications (Email, SMS, Slack, Teams)

---

## Prerequisites

- **Node.js** 18.x or higher
- **npm** 9.x or higher
- **Git**

---

## Getting Started

### 1. Clone Repository
```bash
git clone <repository-url>
cd PFA2.2
```

### 2. Install Dependencies
```bash
# Frontend
npm install

# Backend
cd backend
npm install
cd ..
```

### 3. Configure Environment

**Backend (.env):**
```bash
cd backend
cp .env.example .env
# Edit .env:
# - DATABASE_URL (SQLite for dev)
# - JWT_SECRET (generate: openssl rand -base64 32)
# - GEMINI_API_KEY (from https://ai.google.dev/)
```

**Frontend (.env.local):**
```bash
cd ..
cp .env.example .env.local
# Edit .env.local:
# - VITE_API_URL=http://localhost:3001
```

### 4. Setup Database
```bash
cd backend
npm run prisma:migrate
npm run prisma:seed
```

### 5. Start Development Servers

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
# Runs on http://localhost:3001
```

**Terminal 2 (Frontend):**
```bash
npm run dev
# Runs on http://localhost:3000
```

### 6. Login
Navigate to `http://localhost:3000`
- Username: `admin`
- Password: `admin123`

---

## Development Workflows

> **📘 For all development commands, architecture patterns, troubleshooting, and contribution guidelines, see [CLAUDE.md](./CLAUDE.md)**

**CLAUDE.md** contains:
- Build, test, lint, database commands
- Architecture patterns (Sandbox, Multi-Org, Drag-Drop, PEMS Sync)
- Common tasks (add fields, filters, bulk operations)
- Troubleshooting guide
- Git/GitHub best practices

---

## Project Structure

```
PFA2.2/
├── .claude/                           # Claude Code configuration
│   ├── agents/                        # Specialized agent definitions
│   └── commands/                      # Custom slash commands
│
├── backend/                           # Express.js API + Prisma ORM
│   ├── prisma/
│   │   ├── schema.prisma              # Database schema (Single Source of Truth)
│   │   ├── migrations/                # Database migrations
│   │   ├── seeds/                     # Seed data files
│   │   └── seed.ts                    # Seed orchestrator
│   ├── src/
│   │   ├── config/                    # Environment & database config
│   │   ├── controllers/               # Route controllers (30+ files)
│   │   ├── middleware/                # Auth, permissions, audit
│   │   ├── models/                    # Business logic models
│   │   ├── routes/                    # API route definitions
│   │   ├── services/                  # Business services
│   │   │   ├── ai/                    # AI services (20+ files)
│   │   │   ├── aiDataHooks/           # AI data collection hooks
│   │   │   ├── auth/                  # Authentication services
│   │   │   ├── pems/                  # PEMS sync services
│   │   │   └── sync/                  # Sync orchestration
│   │   ├── types/                     # TypeScript types
│   │   ├── utils/                     # Utility functions
│   │   ├── workers/                   # Background workers
│   │   └── server.ts                  # Express app entry point
│   ├── scripts/                       # Utility scripts
│   │   ├── db/                        # Database utilities
│   │   ├── sync/                      # Sync utilities
│   │   └── maintenance/               # Maintenance tasks
│   ├── tests/                         # Backend tests
│   │   ├── integration/               # Integration tests
│   │   ├── unit/                      # Unit tests
│   │   └── security/                  # Security tests
│   └── logs/                          # Application logs
│
├── components/                        # React UI components
│   ├── admin/                         # Admin dashboard (20+ components)
│   ├── beo/                           # BEO analytics components
│   ├── permissions/                   # Permission UI components
│   ├── settings/                      # Settings components
│   └── *.tsx                          # Core components (Timeline, Grid, etc.)
│
├── contexts/                          # React contexts
│   └── AuthContext.tsx                # JWT authentication state
│
├── services/                          # Frontend API clients
│   └── apiClient.ts                   # HTTP client for backend API
│
├── hooks/                             # Custom React hooks
│
├── docs/                              # All project documentation
│   ├── adrs/                          # Architecture Decision Records
│   │   ├── ADR-005-multi-tenant-access-control/  # ✅ Implemented
│   │   ├── ADR-006-api-server-and-endpoint-architecture/  # 🏗️ In Design
│   │   └── ADR-007-api-connectivity-and-intelligence-layer/  # 🏗️ In Design
│   ├── backend/                       # Backend-specific docs
│   │   ├── API_REFERENCE.md           # REST API documentation
│   │   └── MIGRATION-GUIDE-POSTGRESQL.md
│   ├── frontend/                      # Frontend-specific docs
│   ├── implementation/                # Implementation plans
│   ├── user/                          # End-user documentation
│   ├── accessibility/                 # Accessibility testing docs
│   ├── performance/                   # Performance testing docs
│   ├── testing/                       # Testing documentation
│   ├── archive/                       # Historical documentation
│   ├── ARCHITECTURE.md                # System architecture (1,500+ lines)
│   ├── CODING_STANDARDS.md            # Code quality standards
│   ├── DOCUMENTATION_STANDARDS.md     # Documentation workflow
│   ├── DEVELOPMENT_LOG.md             # Development tracking
│   └── TESTING_LOG.md                 # Test execution history
│
├── tests/                             # Frontend tests
│   ├── accessibility/                 # A11y tests
│   └── e2e/                           # End-to-end tests
│
├── temp/                              # Temporary files (gitignored)
│   ├── agent-work/                    # AI agent working files
│   ├── compile/                       # Compilation results
│   ├── test-output/                   # Test artifacts
│   └── archive/                       # Archived temp files
│
├── database/                          # Database utilities
│   ├── backups/                       # Database backups
│   ├── backup-scripts/                # Backup automation
│   ├── init-scripts/                  # Initialization scripts
│   └── logs/                          # Database logs
│
├── load-tests/                        # Performance load testing
│   └── processors/                    # Load test processors
│
├── mockData/                          # Mock data for testing
├── Sample_data/                       # Sample CSV files
│
├── App.tsx                            # Root React component (sandbox pattern)
├── types.ts                           # Shared TypeScript interfaces
├── utils.ts                           # Shared business logic
├── mockData.ts                        # Static PFA/Asset data (20K+ records)
├── CLAUDE.md                          # AI context router
├── README.md                          # This file
└── package.json                       # Frontend dependencies
```

---

## Documentation

### Essential Reading (Required Before Contributing)
1. **[CLAUDE.md](./CLAUDE.md)** - AI/developer instruction manual
2. **[DOCUMENTATION_STANDARDS.md](./docs/DOCUMENTATION_STANDARDS.md)** - Git workflow, commit conventions
3. **[CODING_STANDARDS.md](./docs/CODING_STANDARDS.md)** - Code quality standards

### Technical Documentation
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System architecture (1,500+ lines)
- **[API.md](./docs/API.md)** - Backend API reference
- **[COMPONENTS.md](./docs/COMPONENTS.md)** - React component catalog

### Process Documentation
- **[DEVELOPMENT_LOG.md](./docs/DEVELOPMENT_LOG.md)** - Development tracking
- **[TESTING_LOG.md](./docs/TESTING_LOG.md)** - Test execution history

### Architecture Decisions
- **[ADR Index](./docs/adrs/README.md)** - Complete ADR catalog
- **[ADR-005: Multi-Tenant Access Control](./docs/adrs/ADR-005-multi-tenant-access-control/)** - ✅ Implemented
- **[ADR-006: API Server Architecture](./docs/adrs/ADR-006-api-server-and-endpoint-architecture/)** - 🏗️ In Design
- **[ADR-007: Intelligence Layer](./docs/adrs/ADR-007-api-connectivity-and-intelligence-layer/)** - 🏗️ In Design

---

## Tech Stack

**Frontend:** React 19, TypeScript, Vite 5, Tailwind CSS
**Backend:** Express.js 4.x, Prisma 5.x, SQLite (dev) / PostgreSQL (prod)
**Auth:** JWT + bcrypt
**AI:** Google Gemini, OpenAI GPT-4, Anthropic Claude
**External:** PEMS (HxGN EAM) Grid Data API

---

## Current Status

**Version:** 1.2.0
**Status:** Active Development
**Test Coverage:** 15% (target: 70%)
**Next Release:** 1.3.0 (API Server Architecture - TBD)

### Recent Releases

**v1.2.0** (2025-11-27) - ADR-005 Complete
- ✅ Multi-Tenant Access Control (14 permissions)
- ✅ Financial data masking (compliance)
- ✅ Temporal access for contractors
- ✅ Impersonation mode with audit trail
- ✅ Session management & kill switch
- ✅ Immutable audit ledger
- ✅ Personal Access Tokens (PATs)
- ✅ Secure invitation system
- ✅ Soft delete with 30-day recovery
- ✅ Pre-flight review before PEMS sync
- ✅ Revert/undo via time travel
- ✅ Multi-channel notifications
- ✅ AI-powered permission hints
- ✅ Role drift detection

**v1.1.0** (2025-11-25)
- PEMS integration with batch sync
- Sync tracking UI
- Multi-organization context switching

**v1.0.0** (2025-11-01)
- Core PFA tracking
- Timeline visualization
- AI Assistant integration

See [DEVELOPMENT_LOG.md](./docs/DEVELOPMENT_LOG.md) for full history.

---

## Contributing

### Required Reading Before Contributing
1. [CODING_STANDARDS.md](./docs/CODING_STANDARDS.md) - TypeScript strict mode, 20-line rule, React patterns
2. [DOCUMENTATION_STANDARDS.md](./docs/DOCUMENTATION_STANDARDS.md) - Git workflow, commit conventions
3. [CLAUDE.md](./CLAUDE.md) - Domain concepts, architecture patterns, common tasks

### Contribution Workflow
1. Create feature branch: `git checkout -b feature/DEV-XXX-description`
2. Make changes and test locally
3. Update documentation (README.md if features changed, DEVELOPMENT_LOG.md)
4. Commit: `git commit -m "[FEAT] Brief description - DEV-XXX"`
5. Push and create PR

**Commit Rules:**
- ✅ Commit BEFORE major refactoring (safety checkpoint)
- ✅ Commit AFTER functionality works (test first)
- ❌ Never commit broken code to main

See [CLAUDE.md](./CLAUDE.md) for full Git/GitHub best practices.

---

## Support

**Questions?** See [CLAUDE.md](./CLAUDE.md) for comprehensive project guide.

**Issues?** See [Known Issues](./CLAUDE.md#known-issues) section.

**Security?** See [Security](./CLAUDE.md#security) section.

---

**Document Version:** 3.0 (Updated Structure & ADR Context)
**Last Updated:** 2025-11-28
**Maintained By:** PFA Vanguard Project Team
