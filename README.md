# PFA Vanguard

> Construction equipment tracking system for Plan-Forecast-Actual lifecycle management

[![Status](https://img.shields.io/badge/status-active_development-success.svg)]()
[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)]()
[![License](https://img.shields.io/badge/license-proprietary-red.svg)]()

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Documentation](#-documentation)
- [Project Status](#-project-status)
- [Contributing](#-contributing)

## 🎯 Overview

**PFA Vanguard** helps Project Managers track and optimize equipment costs across large industrial construction projects. It manages the complete **Plan → Forecast → Actuals** lifecycle for 10,000+ equipment requirements.

**Core Purpose:** Ensure actual equipment costs don't exceed budgeted amounts by strategically adjusting forecasts to navigate the gap between plan and reality.

**Business Value:**
- Real-time variance tracking (Plan vs. Forecast vs. Actual)
- Drag-and-drop timeline adjustments for 800+ simultaneous records
- Smart bulk operations with state-aware logic
- Multi-organization data isolation for concurrent projects
- PEMS integration for seamless external system synchronization

## ✨ Features

### Current Features (Production-Ready)

- ✅ **PFA Lifecycle Tracking**
  - Plan (locked budget baseline)
  - Forecast (PM strategy, editable)
  - Actual (billing reality)

- ✅ **Timeline Visualization**
  - Gantt chart with multi-layer rendering (Plan/Forecast/Actual)
  - Drag-and-drop editing with live preview
  - Scale switching (Day/Week/Month/Year)
  - Supports 800+ records with virtual scrolling

- ✅ **Bulk Operations**
  - Smart time shifting (state-aware: Forecast vs. Actual)
  - Duration adjustments
  - Category/DOR changes
  - Equipment assignment
  - Reset to Plan baseline

- ✅ **Multi-Organization Isolation**
  - Isolated data per construction project
  - Context switching between organizations
  - Organization-specific filters

- ✅ **PEMS Integration**
  - Real-time sync with HxGN EAM (PEMS Grid Data API)
  - Batch processing (10,000 records/call)
  - Progress tracking with UI modal
  - Sync history and statistics

- ✅ **AI Assistant**
  - Natural language queries ("Show me rentals over $5000 in Silo 4")
  - Multi-provider support (Google Gemini, OpenAI, Anthropic Claude)
  - Panel mode and Voice mode
  - Confirmation required for mutations

- ✅ **Authentication & Security**
  - JWT-based authentication
  - bcrypt password hashing
  - Role-based access control (admin, user, viewer)
  - Organization-level data isolation

- ✅ **Visualization Options**
  - Timeline Lab (Gantt chart)
  - Matrix View (month-by-month breakdown)
  - Grid Lab (tabular view with sorting)
  - KPI Board (variance dashboard)

- ✅ **Sandbox Pattern**
  - Experiment with changes without affecting production data
  - 20-level undo/redo history
  - Commit or discard changes

### In Development

- 🚧 **Advanced Filtering** - Save and share filter presets
- 🚧 **Export Templates** - Custom Excel export configurations
- 🚧 **Test Coverage** - Comprehensive test suite (target: 70%)

### Planned

- 📋 **Voice Mode Enhancements** - Speech-to-text AI commands
- 📋 **Mobile App** - iOS/Android companion for field use
- 📋 **ESS Integration** - Direct import from Estimation System
- 📋 **Procurement Integration** - Auto-update actuals from procurement system

## 🛠️ Tech Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite 5** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Context API** - State management (sandbox pattern)

### Backend
- **Express.js 4.x** - HTTP server
- **Prisma 5.x** - ORM and migrations
- **SQLite** (development) / **PostgreSQL** (production)
- **JWT** - Authentication
- **bcrypt** - Password hashing

### External Integrations
- **Google Gemini AI** - Natural language processing
- **OpenAI GPT-4** - Alternative AI provider
- **Anthropic Claude** - Alternative AI provider
- **PEMS (HxGN EAM)** - Equipment management system sync

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Git** - Version control

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18.x or higher
- **npm** 9.x or higher
- **Git** (for cloning repository)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd PFA2.2
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

4. **Setup environment variables**

   **Backend (.env):**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env and configure:
   # - DATABASE_URL (SQLite for dev, PostgreSQL for prod)
   # - JWT_SECRET (generate with: openssl rand -base64 32)
   # - GEMINI_API_KEY (from https://ai.google.dev/)
   # - OPENAI_API_KEY (optional, from https://platform.openai.com/)
   # - ANTHROPIC_API_KEY (optional, from https://console.anthropic.com/)
   ```

   **Frontend (.env.local):**
   ```bash
   cd ..
   cp .env.example .env.local
   # Edit .env.local and configure:
   # - VITE_API_URL=http://localhost:3001
   ```

5. **Setup database and seed data**
   ```bash
   cd backend
   npm run prisma:migrate
   npm run prisma:seed
   ```

6. **Start backend server**
   ```bash
   npm run dev
   # Backend runs on http://localhost:3001
   ```

7. **Start frontend (in new terminal)**
   ```bash
   cd ..
   npm run dev
   # Frontend runs on http://localhost:3000
   ```

8. **Login**
   - Navigate to `http://localhost:3000`
   - Username: `admin`
   - Password: `admin123`

### Development Workflow

```bash
# Run backend
cd backend && npm run dev

# Run frontend (new terminal)
npm run dev

# Run Prisma Studio (database GUI)
cd backend && npx prisma studio

# Generate Prisma client after schema changes
cd backend && npx prisma generate

# Create new migration
cd backend && npx prisma migrate dev --name migration_name
```

## 📚 Documentation

> **⚠️ IMPORTANT:** Before making any changes, read the documentation standards to understand our Git/GitHub workflows, commit conventions, and documentation requirements.

### Core Documentation

- **[CLAUDE.md](./CLAUDE.md)** - 🌟 **START HERE!** Primary project guide for AI assistants and developers
- **[DOCUMENTATION_STANDARDS.md](./docs/DOCUMENTATION_STANDARDS.md)** - **Required reading** for all contributors
  - Git/GitHub best practices (commit messages, branch naming, PR templates)
  - When to commit (before major changes, after functionality works)
  - README.md maintenance (must always reflect current functionality)
  - Documentation workflow and cross-referencing conventions

### Technical Documentation

- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - 🌟 **Comprehensive system architecture** (1,500+ lines)
  - System overview and context diagrams
  - Technology stack breakdown
  - Critical architecture patterns (Sandbox, Multi-org, Drag-and-drop, PEMS sync)
  - Complete data model with ERD diagrams
  - Frontend and backend architecture
  - API design and external integrations
  - Security, performance, and deployment architecture
- **[ARCHITECTURE_CHANGELOG.md](./docs/ARCHITECTURE_CHANGELOG.md)** - History of architectural changes
- **[API.md](./docs/API.md)** - Backend API endpoint reference
- **[COMPONENTS.md](./docs/COMPONENTS.md)** - React component catalog and patterns

### Process Documentation

- **[DEVELOPMENT_LOG.md](./docs/DEVELOPMENT_LOG.md)** - Development tracking and status
- **[TESTING_LOG.md](./docs/TESTING_LOG.md)** - Test execution history
- **[CODING_STANDARDS.md](./docs/CODING_STANDARDS.md)** - Code style guide

### Architecture Decisions

- **[ADR-001: Sandbox Pattern](./docs/ADRs/ADR-001-sandbox-pattern.md)** - Dual-ref architecture for undo/redo
- **[ADR-002: Multi-Org Isolation](./docs/ADRs/ADR-002-multi-org-isolation.md)** - Organization-based data separation
- **[ADR-003: PEMS Integration](./docs/ADRs/ADR-003-pems-integration.md)** - PEMS Grid Data API sync strategy

### User Documentation

- **[USER_GUIDE.md](./docs/USER_GUIDE.md)** - End-user instructions (coming soon)
- **[ADMIN_GUIDE.md](./docs/ADMIN_GUIDE.md)** - Administrator manual (coming soon)
- **[DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md)** - Deployment procedures (coming soon)

## 📊 Project Status

**Current Version:** 1.1.0
**Status:** Active Development
**Test Coverage:** 0% (target: 70%)
**Last Deploy:** N/A (staging)
**Next Release:** 1.2.0 (PEMS Sync - 2025-12-01)

### Active Development

- [DEV-150] Advanced filtering with saved presets
- [DEV-151] Custom Excel export templates
- [TEST-001] Unit test suite setup

### Recent Releases

**v1.1.0** (2025-11-25)
- PEMS integration with batch sync
- Sync tracking UI in Admin Dashboard
- Multi-organization context switching

**v1.0.0** (2025-11-01)
- Initial release with core PFA tracking
- Timeline visualization with drag-and-drop
- AI Assistant integration

See [DEVELOPMENT_LOG.md](./docs/DEVELOPMENT_LOG.md) for full development history.

## 🤝 Contributing

### Before Contributing

**⚠️ REQUIRED READING - All contributors must read these before making changes:**

1. **[Coding Standards](./docs/CODING_STANDARDS.md)** - Enterprise-grade code quality standards
   - TypeScript strict mode, no `any`, explicit return types
   - 20-line function rule
   - React best practices (hooks, performance, patterns)
   - Backend standards (service layer, validation, error handling)
   - Security practices (input validation, secrets management)

2. **[Documentation Standards](./docs/DOCUMENTATION_STANDARDS.md)** - How we document and commit
   - When to commit (before major changes, after functionality works)
   - README.md maintenance (must always reflect current functionality)
   - Git/GitHub best practices (commit messages, branch naming, PR templates)

3. **[Project Guide (CLAUDE.md)](./CLAUDE.md)** - Comprehensive project overview
   - Domain concepts (PFA lifecycle, field groups, cost calculation)
   - Critical architecture patterns (sandbox, multi-org, drag-and-drop)
   - Key files and common tasks

### Contribution Workflow

1. **Create feature branch**
   ```bash
   git checkout -b feature/DEV-XXX-description
   ```

2. **Make changes and test**
   - Test functionality locally
   - Ensure TypeScript compiles
   - Run tests (if they exist)

3. **Update documentation**
   - Update README.md if functionality changed
   - Update DEVELOPMENT_LOG.md with status
   - Update API.md or COMPONENTS.md if applicable

4. **Commit with proper message**
   ```bash
   git commit -m "[FEAT] Brief description - DEV-XXX"
   ```
   See [DOCUMENTATION_STANDARDS.md](./docs/DOCUMENTATION_STANDARDS.md) Section 11.3 for commit message format.

5. **Push and create PR**
   ```bash
   git push origin feature/DEV-XXX-description
   ```

### Commit Before Major Changes

⚠️ **Always commit working code before starting major refactoring.** This creates a safety checkpoint for rollback.

### Commit After Functionality Works

✅ **Only commit code that has been tested and works.** Don't commit broken code to main branch.

---

**Document Version:** 1.0
**Last Updated:** 2025-11-25
**Maintained By:** PFA Vanguard Project Team

**Questions?** See [CLAUDE.md](./CLAUDE.md) or [DOCUMENTATION_STANDARDS.md](./docs/DOCUMENTATION_STANDARDS.md)
