# Backend Documentation

**Last Updated:** 2025-11-25
**Status:** Current

> **Purpose**: Backend-specific documentation including API references, database management, security, and services.

---

## 📖 Available Documentation

### API & Endpoints

| Document | Purpose | Status | Lines |
|----------|---------|--------|-------|
| **[API_REFERENCE.md](./API_REFERENCE.md)** | REST API endpoint reference | 📋 Planned | TBD |

**Contents**:
- Authentication endpoints (`/api/auth/*`)
- PEMS sync endpoints (`/api/pems/*`)
- Data source mapping endpoints (`/api/data-sources/*`)
- API configuration endpoints (`/api/configs/*`)
- Request/response schemas

---

### Database Management

| Document | Purpose | Status | Lines |
|----------|---------|--------|-------|
| **[MIGRATION-GUIDE-POSTGRESQL.md](./MIGRATION-GUIDE-POSTGRESQL.md)** | SQLite → PostgreSQL migration guide | ✅ Complete | 300+ |
| **[DATABASE_MONITORING.md](./DATABASE_MONITORING.md)** | Database performance monitoring setup | ✅ Complete | 400+ |

**MIGRATION-GUIDE-POSTGRESQL.md** covers:
- Migration preparation and testing
- Schema migration with Prisma
- Data migration strategies
- Performance optimization
- Production deployment

**DATABASE_MONITORING.md** covers:
- PostgreSQL monitoring setup
- Query performance tracking
- Connection pooling
- Index optimization
- Backup and recovery

---

### Security & Secrets

| Document | Purpose | Status | Lines |
|----------|---------|--------|-------|
| **[SECRETS_MANAGEMENT.md](./SECRETS_MANAGEMENT.md)** | Secrets management for production | ✅ Complete | 600+ |

**Contents**:
- AWS Secrets Manager integration
- Encryption strategies (AES-256-GCM)
- JWT token management
- API key rotation
- Environment-specific configs

---

## 🔧 Backend Architecture Overview

**Tech Stack**:
- **Framework**: Express.js + TypeScript
- **ORM**: Prisma
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **Authentication**: JWT + bcrypt
- **Security**: AES-256-GCM encryption, rate limiting

**Key Services**:
- `AuthService` - JWT authentication, password hashing
- `PemsSyncService` - Batch sync with PEMS Grid Data API
- `DataSourceOrchestrator` - API switching with fallback
- `EncryptionService` - Credential encryption/decryption
- `AiService` - Multi-provider AI integration (Gemini, OpenAI, Claude)

---

## 📂 Backend File Structure

```
backend/
├── prisma/
│   ├── schema.prisma           # Database schema (9 models)
│   ├── migrations/             # Database migrations
│   ├── seed.ts                 # Seed data script
│   └── dev.db                  # SQLite database (development)
├── src/
│   ├── config/                 # Environment and database config
│   ├── controllers/            # Route controllers
│   ├── middleware/             # Authentication, rate limiting
│   ├── models/                 # Business logic models
│   ├── routes/                 # API route definitions
│   ├── services/               # Business services
│   │   ├── pems/               # PEMS sync services
│   │   ├── auth/               # Authentication services
│   │   └── ai/                 # AI integration services
│   ├── types/                  # TypeScript types
│   ├── utils/                  # Utilities (logger, encryption)
│   └── server.ts               # Express app entry point
├── scripts/                    # Utility scripts
│   ├── db/                     # Database utilities
│   └── sync/                   # Sync utilities
├── .env                        # Environment variables
└── package.json                # Dependencies
```

---

## 🚀 Quick Start

### Development Setup

```bash
cd backend
npm install

# Setup database
npm run prisma:migrate
npm run prisma:seed

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start development server
npm run dev  # Runs on port 3001
```

### Common Commands

```bash
# Database
npm run prisma:studio      # Open Prisma Studio (database GUI)
npm run prisma:migrate     # Run migrations
npm run prisma:generate    # Generate Prisma client

# Scripts
npx tsx scripts/db/check-feeds.ts              # Check PEMS feeds
npx tsx scripts/db/update-feeds.ts             # Update PEMS feeds
npx tsx scripts/db/clear-pfa-data.ts           # Clear PFA data

# Development
npm run dev                # Start dev server with hot reload
npm run build              # Build for production
npm start                  # Start production server
```

---

## 🔗 Related Documentation

- **[../ARCHITECTURE.md](../ARCHITECTURE.md)** - Full-stack system architecture
- **[../CODING_STANDARDS.md](../CODING_STANDARDS.md) Section 8** - Backend coding standards
- **[../adrs/](../adrs/)** - Architecture decision records
- **[../implementation/](../implementation/)** - Implementation plans

---

## 📝 Contributing

When adding backend documentation:

1. **API Changes**: Update [API_REFERENCE.md](./API_REFERENCE.md)
2. **New Services**: Document in service-specific file or ARCHITECTURE.md
3. **Database Changes**: Update migration guide if schema changes
4. **Security**: Update SECRETS_MANAGEMENT.md for new credentials
5. **Scripts**: Document in backend/scripts/README.md

---

**Questions?** See [DOCUMENTATION_STANDARDS.md](../DOCUMENTATION_STANDARDS.md) or [docs/README.md](../README.md)
